'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { motion } from 'framer-motion';
import { 
  Bed, 
  Wrench, 
  Sparkles, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  CalendarClock,
  UserCheck,
  DoorOpen,
  Brush,
  LogIn,
  CreditCard,
  CalendarPlus,
  Wifi,
  Star,
  TrendingUp,
  TrendingDown,
  Bell,
  Info,
  ShieldAlert,
  ArrowUpRight,
  Package,
  Users
} from 'lucide-react';

interface RoomStatus {
  available: number;
  occupied: number;
  maintenance: number;
  dirty: number;
  out_of_order: number;
}

interface Task {
  id: string;
  type: string;
  title: string;
  room: string | null;
  status: string;
  priority: string;
  scheduledAt: string | null;
  assignee: string | null;
}

interface DashboardStats {
  revenue: { today: number; thisWeek: number; thisMonth: number; change: number | null };
  occupancy: { today: number; thisWeek: number; thisMonth: number; change: number };
  bookings: { today: number; thisWeek: number; thisMonth: number; pending: number };
  guests: { checkedIn: number; arriving: number; departing: number; total: number };
  adr: number;
  revpar: number;
  activeWifiSessions: number;
  pendingServiceRequests: number;
  lowStockItems: number;
}

interface ApiActivityItem {
  id: string;
  type: 'booking' | 'check_in' | 'check_out' | 'payment';
  title: string;
  description: string;
  guest: { name: string; initials: string };
  room: string | null;
  timestamp: string;
  status: string;
  amount: number;
}

interface ApiAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: string | Date;
}

interface CommandCenterData {
  stats: DashboardStats;
  rooms: RoomStatus;
  totalRooms: number;
  upcomingCheckIns: number;
  staffOnDuty: number;
  todaysTasks: Task[];
  recentActivity: ApiActivityItem[];
  alerts: ApiAlert[];
}

// --- Derived data types ---

interface QuickStatItem {
  label: string;
  value: string | number;
  icon: typeof Bed;
  trend: string;
  trendUp: boolean;
  color: string;
}

interface ActivityEvent {
  time: string;
  icon: typeof LogIn;
  title: string;
  desc: string;
  color: string;
  border: string;
}

interface AlertItem {
  severity: 'critical' | 'warning' | 'info';
  icon: typeof ShieldAlert;
  title: string;
  desc: string;
  timestamp: string;
  action: string;
}

// --- Severity styles ---

const severityStyles = {
  critical: { border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  info: { border: 'border-l-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30', iconColor: 'text-teal-500', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400' },
};

// --- Animation variants ---

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// --- Helpers ---

function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString()}`;
}

function timeAgo(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function buildQuickStats(stats: DashboardStats): QuickStatItem[] {
  return [
    { label: "Today's Check-ins", value: stats.guests.arriving, icon: LogIn, trend: `${stats.guests.arriving} arrivals`, trendUp: true, color: 'bg-emerald-500' },
    { label: "Today's Revenue", value: formatCurrency(stats.revenue.today), icon: CreditCard, trend: stats.revenue.change !== null ? `${stats.revenue.change >= 0 ? '+' : ''}${stats.revenue.change}% vs last week` : 'No prior data', trendUp: (stats.revenue.change ?? 0) >= 0, color: 'bg-teal-500' },
    { label: 'Available Rooms', value: stats.bookings.pending, icon: DoorOpen, trend: `${stats.occupancy.today}% occupied`, trendUp: stats.occupancy.today < 90, color: 'bg-amber-500' },
    { label: 'Active WiFi', value: stats.activeWifiSessions, icon: Wifi, trend: `${stats.guests.checkedIn} guests`, trendUp: true, color: 'bg-emerald-500' },
    { label: 'Service Requests', value: stats.pendingServiceRequests, icon: Wrench, trend: stats.pendingServiceRequests > 5 ? 'Needs attention' : 'Under control', trendUp: stats.pendingServiceRequests <= 5, color: 'bg-red-500' },
    { label: 'ADR', value: `₹${stats.adr.toLocaleString()}`, icon: Star, trend: `RevPAR ₹${stats.revpar.toLocaleString()}`, trendUp: true, color: 'bg-yellow-500' },
  ];
}

function buildActivityEvents(items: ApiActivityItem[]): ActivityEvent[] {
  const iconMap: Record<string, typeof LogIn> = {
    check_in: LogIn,
    check_out: DoorOpen,
    booking: CalendarPlus,
    payment: CreditCard,
  };
  const colorMap: Record<string, string> = {
    check_in: 'bg-emerald-500',
    check_out: 'bg-amber-500',
    booking: 'bg-teal-500',
    payment: 'bg-cyan-500',
  };
  const borderMap: Record<string, string> = {
    check_in: 'border-l-emerald-500',
    check_out: 'border-l-amber-500',
    booking: 'border-l-teal-500',
    payment: 'border-l-cyan-500',
  };

  return items.slice(0, 8).map((item) => ({
    time: timeAgo(item.timestamp),
    icon: iconMap[item.type] || CalendarPlus,
    title: item.title,
    desc: item.guest.name + (item.room ? ` — ${item.description}` : ''),
    color: colorMap[item.type] || 'bg-gray-500',
    border: borderMap[item.type] || 'border-l-gray-500',
  }));
}

function buildAlerts(items: ApiAlert[]): AlertItem[] {
  const iconMap: Record<string, typeof ShieldAlert> = {
    critical: ShieldAlert,
    warning: AlertTriangle,
    info: Info,
  };
  const actionMap: Record<string, string> = {
    inventory: 'Order Stock',
    service: 'View Requests',
    room: 'Assign Staff',
    maintenance: 'Schedule Repair',
    system: 'Acknowledge',
  };
  const severityMap: Record<string, 'critical' | 'warning' | 'info'> = {
    critical: 'critical',
    warning: 'warning',
    info: 'info',
  };

  return items.slice(0, 6).map((item) => ({
    severity: (severityMap[item.severity] || 'info') as 'critical' | 'warning' | 'info',
    icon: iconMap[item.severity] || Info,
    title: item.title,
    desc: item.message,
    timestamp: timeAgo(item.timestamp),
    action: actionMap[item.type] || 'Review',
  }));
}

// --- New Sub-Components ---

function QuickStatCard({ stat, index }: { stat: QuickStatItem; index: number }) {
  return (
    <motion.div
      variants={itemVariants}
      custom={index}
      className="group"
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2', stat.color)}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-xl font-bold tracking-tight">{stat.value}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {stat.trendUp ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={stat.trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                {stat.trend}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Activity Timeline</CardTitle>
              <CardDescription className="text-xs">Recent events across property</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[440px] pr-3 -mr-3">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-1">
              {events.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-center">
                  <div>
                    <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  </div>
                </div>
              ) : (
                events.map((event, i) => {
                  const EventIcon = event.icon;
                  return (
                    <motion.div
                      key={`${event.title}-${i}`}
                      variants={itemVariants}
                      className="relative flex gap-3 pl-2 group"
                    >
                      {/* Dot on the line */}
                      <div className={cn(
                        'relative z-10 mt-3 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center',
                        event.color,
                        'text-white'
                      )}>
                        <EventIcon className="h-3.5 w-3.5" />
                      </div>
                      {/* Content card */}
                      <div className={cn(
                        'flex-1 ml-1 border-l-[3px] rounded-r-lg p-3 pl-4 mb-1',
                        'border-l-transparent hover:border-l-current transition-colors',
                        event.border,
                        'hover:bg-muted/40 transition-colors'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{event.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.desc}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{event.time}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AlertCards({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card className="border border-border/50 shadow-sm h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-rose-600">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Active Alerts</CardTitle>
              <CardDescription className="text-xs">{alerts.length} alerts require attention</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {alerts.filter(a => a.severity === 'critical').length} Critical
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[440px] pr-3 -mr-3">
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-center">
                <div>
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500/60" />
                  <p className="text-sm text-muted-foreground">All clear — no active alerts</p>
                </div>
              </div>
            ) : (
              alerts.map((alert, i) => {
                const AlertIcon = alert.icon;
                const styles = severityStyles[alert.severity];
                return (
                  <motion.div
                    key={`${alert.title}-${i}`}
                    variants={itemVariants}
                    className={cn(
                      'rounded-lg border-l-[3px] p-3 cursor-pointer',
                      'hover:shadow-sm transition-all',
                      styles.border,
                      styles.bg
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertIcon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', styles.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium leading-tight">{alert.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{alert.desc}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">{alert.timestamp}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 gap-1 hover:bg-white/60 dark:hover:bg-white/10"
                          >
                            {alert.action}
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RoomStatusCard({ 
  title, 
  count, 
  total, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  count: number; 
  total: number; 
  icon: typeof Bed;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className={cn("rounded-lg p-2", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <span className="text-sm font-bold">{count}</span>
        </div>
        <div className="mt-1.5">
          <Progress value={percentage} className="h-1.5" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{percentage}% of total</p>
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
    urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  };

  const statusConfig = {
    pending: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
    in_progress: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400', icon: Loader2 },
    completed: { color: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary', icon: CheckCircle2 },
  };

  const typeIcons: Record<string, typeof Sparkles> = {
    cleaning: Brush,
    maintenance: Wrench,
    inspection: CheckCircle2,
    other: Sparkles,
  };

  const TypeIcon = typeIcons[task.type] || Sparkles;
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
      <div className={cn("rounded-lg p-2 bg-muted", task.status === 'in_progress' && "animate-pulse")}>
        <TypeIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <Badge variant="secondary" className={cn("text-[10px] h-4 px-1", priority.color)}>
            {task.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.room && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              Room {task.room}
            </Badge>
          )}
          {task.assignee && (
            <span className="text-xs text-muted-foreground">{task.assignee}</span>
          )}
        </div>
      </div>
      <StatusIcon className={cn(
        "h-4 w-4",
        task.status === 'pending' && "text-muted-foreground",
        task.status === 'in_progress' && "text-cyan-600 dark:text-cyan-400 animate-spin",
        task.status === 'completed' && "text-primary"
      )} />
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div className="space-y-6">
      {/* Quick Stats Grid skeleton */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3-Column Grid skeleton */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Timeline + Alerts skeleton */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border border-border/50 shadow-sm lg:col-span-3">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="border border-border/50 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const [data, setData] = React.useState<CommandCenterData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        if (result.success) {
          const api = result.data;
          setData({
            stats: api.stats,
            rooms: api.commandCenter.rooms,
            totalRooms: api.commandCenter.totalRooms,
            upcomingCheckIns: api.commandCenter.upcomingCheckIns,
            staffOnDuty: api.commandCenter.staffOnDuty,
            todaysTasks: api.commandCenter.todaysTasks,
            recentActivity: api.recentActivity,
            alerts: api.alerts,
          });
        } else {
          setError(result.error?.message || 'Failed to load data');
        }
      } catch (err) {
        setError('Failed to fetch command center data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <CommandCenterSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border border-border/50 shadow-sm border-destructive/50">
        <CardContent className="p-6 flex items-center justify-center h-[400px] text-muted-foreground">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">{error || 'Failed to load command center data'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build derived data from API response
  const quickStats = buildQuickStats(data.stats);
  const activityEvents = buildActivityEvents(data.recentActivity);
  const alertItems = buildAlerts(data.alerts);

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      >
        {quickStats.map((stat, i) => (
          <QuickStatCard key={stat.label} stat={stat} index={i} />
        ))}
      </motion.div>

      {/* Existing 3-Column Grid: Room Status, Operations, Tasks */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-3"
      >
        {/* Room Status Overview */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary">
                    <Bed className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Room Status</CardTitle>
                    <CardDescription className="text-xs">{data.totalRooms} total rooms</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <RoomStatusCard
                title="Available"
                count={data.rooms.available}
                total={data.totalRooms}
                icon={DoorOpen}
                color="bg-gradient-to-br from-primary to-primary"
              />
              <RoomStatusCard
                title="Occupied"
                count={data.rooms.occupied}
                total={data.totalRooms}
                icon={Bed}
                color="bg-gradient-to-br from-violet-500 to-purple-600"
              />
              <RoomStatusCard
                title="Dirty"
                count={data.rooms.dirty}
                total={data.totalRooms}
                icon={Brush}
                color="bg-gradient-to-br from-amber-500 to-orange-600"
              />
              <RoomStatusCard
                title="Maintenance"
                count={data.rooms.maintenance}
                total={data.totalRooms}
                icon={Wrench}
                color="bg-gradient-to-br from-pink-500 to-rose-600"
              />
              <RoomStatusCard
                title="Out of Order"
                count={data.rooms.out_of_order}
                total={data.totalRooms}
                icon={AlertTriangle}
                color="bg-gradient-to-br from-red-500 to-rose-600"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Operations Status */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Operations Status</CardTitle>
                  <CardDescription className="text-xs">Real-time metrics</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upcoming Check-ins */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="rounded-lg p-2 bg-gradient-to-br from-primary to-primary">
                  <CalendarClock className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Upcoming Check-ins</p>
                  <p className="text-xs text-muted-foreground">Next 3 hours</p>
                </div>
                <span className="text-2xl font-bold text-primary">{data.upcomingCheckIns}</span>
              </div>

              {/* Staff on Duty */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="rounded-lg p-2 bg-gradient-to-br from-violet-500 to-purple-600">
                  <UserCheck className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Staff on Duty</p>
                  <p className="text-xs text-muted-foreground">Active employees</p>
                </div>
                <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{data.staffOnDuty}</span>
              </div>

              {/* Pending Tasks */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="rounded-lg p-2 bg-gradient-to-br from-amber-500 to-orange-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Pending Tasks</p>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </div>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {data.todaysTasks.filter(t => t.status === 'pending').length}
                </span>
              </div>

              {/* In Progress Tasks */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="rounded-lg p-2 bg-gradient-to-br from-cyan-500 to-teal-600">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">In Progress</p>
                  <p className="text-xs text-muted-foreground">Being handled</p>
                </div>
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {data.todaysTasks.filter(t => t.status === 'in_progress').length}
                </span>
              </div>

              {/* Quick Actions */}
              <div className="pt-2">
                <Button variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => useUIStore.getState().setActiveSection('dashboard-overview')}>
                  View All Operations
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Tasks */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Today's Tasks</CardTitle>
                    <CardDescription className="text-xs">{data.todaysTasks.length} scheduled</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => useUIStore.getState().setActiveSection('housekeeping-tasks')}>
                  View All
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {data.todaysTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <div className="rounded-full bg-muted p-3 mb-2">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">All tasks completed</p>
                  <p className="text-xs text-muted-foreground">No pending tasks for today</p>
                </div>
              ) : (
                <ScrollArea className="h-[320px] pr-3 -mr-3">
                  <div className="space-y-2">
                    {data.todaysTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Activity Timeline + Alert Cards — 2 column layout */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-5"
      >
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <ActivityTimeline events={activityEvents} />
        </motion.div>
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <AlertCards alerts={alertItems} />
        </motion.div>
      </motion.div>
    </div>
  );
}
