'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  TrendingUp,
  Star,
  Users,
  CheckCircle,
  Clock,
  Target,
  Award,
  Calendar,
  BarChart3,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SectionGuard } from '@/components/common/section-guard';
import PerformanceReviews from './performance-reviews';
import GoalsTracking from './goals-tracking';

/* ─── Interfaces ─── */
interface StaffItem {
  id: string;
  name: string;
  role: string;
  department: string;
  rating: number;
  reviewRating: number | null;
  tasksCompleted: number;
  tasksInProgress: number;
  avgCompletionTime: number;
  attendance: number;
  performance: number;
  reviewStatus: string | null;
  latestReviewId: string | null;
}

interface DepartmentStat {
  department: string;
  staff: number;
  tasksCompleted: number;
  avgRating: number;
  efficiency: number;
}

interface WeeklyTrendItem {
  day: string;
  completed: number;
  pending: number;
  inProgress: number;
}

interface DashboardData {
  totalStaff: number;
  activeToday: number;
  avgRating: number;
  tasksCompleted: number;
  avgResponseTime: number;
  attendanceRate: number;
  onTimeRate: number;
  goalsSummary: { total: number; completed: number; inProgress: number; atRisk: number };
  staffList: StaffItem[];
  departmentStats: DepartmentStat[];
  weeklyTrend: WeeklyTrendItem[];
  departments: string[];
}

/* ─── Chart config ─── */
const chartConfig = {
  completed: { label: 'Completed', color: '#10b981' },
  inProgress: { label: 'In Progress', color: '#f59e0b' },
  pending: { label: 'Pending', color: '#ec4899' },
} satisfies ChartConfig;

const chartColors = ['#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

/* ─── Helpers ─── */
function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function perfColor(v: number): string {
  if (v >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (v >= 75) return 'text-amber-600 dark:text-amber-400';
  if (v >= 60) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/* ─── Skeleton Loader ─── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-[250px] w-full rounded-lg" /></CardContent></Card>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent></Card>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PerformanceDashboard() {
  const t = useTranslations('staff');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [department, setDepartment] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ days: dateRange, department, _k: String(fetchKey) });
        const res = await fetch(`/api/staff/performance?${params}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error?.message || 'Failed to load data');
        }
      } catch {
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange, department, fetchKey, activeTab]);

  const topPerformers = useMemo(() => {
    if (!data) return [];
    return [...data.staffList].sort((a, b) => b.performance - a.performance).slice(0, 5);
  }, [data]);

  const handleExport = () => {
    if (!data?.staffList) return;
    const rows = data.staffList.map((s) => ({
      Name: s.name,
      Role: s.role,
      Department: s.department,
      Rating: s.rating,
      'Tasks Completed': s.tasksCompleted,
      'Avg Time (min)': s.avgCompletionTime,
      'Attendance %': s.attendance,
      'Performance %': s.performance,
    }));
    const csv = [
      Object.keys(rows[0]).join(','),
      ...rows.map((r) => Object.values(r).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-performance-${dateRange}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  return (
    <SectionGuard permission="staff.view">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('performance') || 'Staff Performance'}</h2>
            <p className="text-muted-foreground">
              {t('performanceDesc') || 'Monitor team productivity, reviews, and goals'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {data?.departments?.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5">
              <Star className="h-3.5 w-3.5 hidden sm:block" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5">
              <Target className="h-3.5 w-3.5 hidden sm:block" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <Award className="h-3.5 w-3.5 hidden sm:block" />
              Top Staff
            </TabsTrigger>
          </TabsList>

          {/* ────────────────── OVERVIEW TAB ────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            {isLoading || !data ? (
              <DashboardSkeleton />
            ) : error ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button variant="outline" onClick={() => setFetchKey((k) => k + 1)}>Retry</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Avg Rating</p>
                          <p className="text-2xl font-bold flex items-center gap-1">
                            {data.avgRating.toFixed(1)}
                            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{data.totalStaff} staff rated</p>
                        </div>
                        <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40">
                          <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Tasks Completed</p>
                          <p className="text-2xl font-bold">{data.tasksCompleted}</p>
                          <p className="text-xs text-muted-foreground mt-1">{data.activeToday} active today</p>
                        </div>
                        <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                          <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                          <p className="text-2xl font-bold">{data.attendanceRate}%</p>
                          <p className="text-xs text-muted-foreground mt-1">On-time: {data.onTimeRate}%</p>
                        </div>
                        <div className="p-3 rounded-full bg-sky-100 dark:bg-sky-900/40">
                          <Clock className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Goals Progress</p>
                          <p className="text-2xl font-bold">
                            {data.goalsSummary.completed}/{data.goalsSummary.total}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {data.goalsSummary.inProgress} in progress &middot; {data.goalsSummary.atRisk} at risk
                          </p>
                        </div>
                        <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/40">
                          <Target className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Weekly Trend Chart */}
                <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Performance Trend
                    </CardTitle>
                    <CardDescription>Weekly task completion overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <BarChart data={data.weeklyTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                        <XAxis dataKey="day" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="pending" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Department Stats + Top Performers */}
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {/* Department Comparison */}
                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Department Comparison
                      </CardTitle>
                      <CardDescription>Efficiency by department</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ScrollArea className="max-h-96">
                        {data.departmentStats.length > 0 ? (
                          data.departmentStats.map((dept, idx) => (
                            <div key={dept.department} className="space-y-2 pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors[idx % chartColors.length] }} />
                                  <span className="font-medium text-sm">{dept.department}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-muted-foreground">{dept.staff}</span>
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                    {dept.efficiency}%
                                  </Badge>
                                </div>
                              </div>
                              <Progress value={dept.efficiency} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{dept.tasksCompleted} tasks</span>
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3" /> {dept.avgRating.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No department data available</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Top Performers */}
                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        Top Performers
                      </CardTitle>
                      <CardDescription>Highest performing team members</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {topPerformers.map((staff, idx) => (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-bold text-xs">
                                {idx + 1}
                              </div>
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
                                  {staff.name.split(' ').map((n) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{staff.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{staff.role}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={cn('text-sm font-bold', perfColor(staff.performance))}>{staff.performance}%</p>
                              <p className="text-xs text-muted-foreground">{staff.tasksCompleted} tasks</p>
                            </div>
                          </div>
                        ))}
                        {topPerformers.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">No performance data yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* All Staff List */}
                <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      All Staff Performance
                    </CardTitle>
                    <CardDescription>Detailed metrics per team member</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-96">
                      <div className="space-y-2">
                        {data.staffList.map((staff) => (
                          <div
                            key={staff.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm">
                                  {staff.name.split(' ').map((n) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{staff.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="truncate">{staff.role}</span>
                                  <span className="hidden sm:inline">&middot;</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">{staff.department}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 pl-13 sm:pl-0">
                              <div className="text-center">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                  <span className="font-medium text-sm">{staff.rating.toFixed(1)}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Rating</p>
                              </div>
                              <div className="text-center">
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                                  {staff.tasksCompleted}
                                </Badge>
                                <p className="text-[10px] text-muted-foreground">Tasks</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="font-medium text-sm">{formatTime(staff.avgCompletionTime)}</p>
                                <p className="text-[10px] text-muted-foreground">Avg Time</p>
                              </div>
                              <div className="text-center hidden md:block">
                                <p className="font-medium text-sm">{staff.attendance}%</p>
                                <p className="text-[10px] text-muted-foreground">Attend.</p>
                              </div>
                              <div className="text-center min-w-[50px]">
                                <p className={cn('text-lg font-bold leading-tight', perfColor(staff.performance))}>
                                  {staff.performance}%
                                </p>
                                <Progress value={staff.performance} className="h-1.5 w-14" />
                              </div>
                            </div>
                          </div>
                        ))}
                        {data.staffList.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">No staff found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ────────────────── REVIEWS TAB ────────────────── */}
          <TabsContent value="reviews">
            <PerformanceReviews />
          </TabsContent>

          {/* ────────────────── GOALS TAB ────────────────── */}
          <TabsContent value="goals">
            <GoalsTracking />
          </TabsContent>

          {/* ────────────────── LEADERBOARD TAB ────────────────── */}
          <TabsContent value="leaderboard">
            <LeaderboardTab data={data} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </SectionGuard>
  );
}

/* ─── Leaderboard Sub-Component ─── */
function LeaderboardTab({ data, isLoading }: { data: DashboardData | null; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full rounded-lg" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const sorted = [...data.staffList].sort((a, b) => b.performance - a.performance);
  const medalColors = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-700', 'bg-orange-400 text-orange-950'];

  return (
    <div className="space-y-4">
      {/* Top 3 podium */}
      {sorted.length >= 3 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 0].map((pos) => {
            const staff = sorted[pos];
            if (!staff) return null;
            return (
              <Card key={staff.id} className={cn('text-center', pos === 0 && 'ring-2 ring-amber-400/50')}>
                <CardContent className="pt-6 pb-4">
                  <div className={cn(
                    'inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm mb-3',
                    medalColors[pos]
                  )}>
                    {pos + 1}
                  </div>
                  <Avatar className="h-16 w-16 mx-auto mb-3">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-lg">
                      {staff.name.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-sm text-muted-foreground">{staff.department}</p>
                  <p className={cn('text-3xl font-bold mt-2', perfColor(staff.performance))}>{staff.performance}%</p>
                  <p className="text-xs text-muted-foreground">{staff.tasksCompleted} tasks &middot; {staff.rating.toFixed(1)} rating</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest of the leaderboard */}
      <Card>
        <CardContent className="pt-6">
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {sorted.slice(3).map((staff, idx) => (
                <div key={staff.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-bold text-sm text-muted-foreground">#{idx + 4}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
                        {staff.name.split(' ').map((n) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">{staff.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">{staff.tasksCompleted} tasks</span>
                    <span className={cn('text-sm font-bold', perfColor(staff.performance))}>{staff.performance}%</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
