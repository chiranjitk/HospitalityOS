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
  ArrowUpRight
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

interface CommandCenterData {
  rooms: RoomStatus;
  totalRooms: number;
  upcomingCheckIns: number;
  staffOnDuty: number;
  todaysTasks: Task[];
}

// --- Mock Data for new sections ---

const recentActivity = [
  { time: '2 min ago', icon: LogIn, title: 'Guest Checked In', desc: 'Vikram Singh — Room 1002', color: 'bg-emerald-500', border: 'border-l-emerald-500' },
  { time: '15 min ago', icon: CreditCard, title: 'Payment Received', desc: '₹12,500 — Room 501', color: 'bg-teal-500', border: 'border-l-teal-500' },
  { time: '32 min ago', icon: CalendarPlus, title: 'New Booking', desc: 'Sneha Gupta — May 12-14', color: 'bg-amber-500', border: 'border-l-amber-500' },
  { time: '1h ago', icon: AlertTriangle, title: 'Late Check-out', desc: 'Rina Chatterjee — Room 305', color: 'bg-red-500', border: 'border-l-red-500' },
  { time: '2h ago', icon: Wrench, title: 'Maintenance Done', desc: 'AC repair — Room 408', color: 'bg-gray-500', border: 'border-l-gray-500' },
  { time: '3h ago', icon: LogIn, title: 'Guest Checked In', desc: 'Arjun Mehta — Room 707', color: 'bg-emerald-500', border: 'border-l-emerald-500' },
  { time: '3h ago', icon: CreditCard, title: 'Payment Received', desc: '₹8,200 — Room 212', color: 'bg-teal-500', border: 'border-l-teal-500' },
  { time: '4h ago', icon: CalendarPlus, title: 'New Booking', desc: 'Priya Nair — May 15-18', color: 'bg-amber-500', border: 'border-l-amber-500' },
];

const activeAlerts = [
  { severity: 'critical' as const, icon: ShieldAlert, title: 'Fire Alarm Malfunction', desc: 'Floor 3 smoke detector sensor needs immediate inspection.', timestamp: '10 min ago', action: 'Dispatch Team' },
  { severity: 'warning' as const, icon: AlertTriangle, title: 'High Occupancy Alert', desc: 'Occupancy at 94% — 3 check-ins pending, only 4 rooms available.', timestamp: '25 min ago', action: 'Review' },
  { severity: 'info' as const, icon: Info, title: 'System Update Scheduled', desc: 'PMS maintenance window tonight at 2:00 AM — expected downtime 15 min.', timestamp: '1h ago', action: 'Acknowledge' },
  { severity: 'warning' as const, icon: AlertTriangle, title: 'Housekeeping Delay', desc: '5 rooms pending cleaning beyond SLA — 3 housekeeping staff short.', timestamp: '45 min ago', action: 'Reassign' },
];

const quickStats = [
  { label: "Today's Check-ins", value: 18, icon: LogIn, trend: '+3 vs yesterday', trendUp: true, color: 'bg-emerald-500' },
  { label: "Today's Revenue", value: '₹1,84,500', icon: CreditCard, trend: '+12% vs yesterday', trendUp: true, color: 'bg-teal-500' },
  { label: 'Available Rooms', value: 24, icon: DoorOpen, trend: '32% available', trendUp: true, color: 'bg-amber-500' },
  { label: 'Average Rating', value: '4.6', icon: Star, trend: '+0.2 this week', trendUp: true, color: 'bg-yellow-500' },
  { label: 'Active WiFi Users', value: 156, icon: Wifi, trend: '42 devices', trendUp: true, color: 'bg-emerald-500' },
  { label: 'Service Requests', value: 7, icon: Wrench, trend: '-2 resolved', trendUp: true, color: 'bg-red-500' },
];

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

// --- New Sub-Components ---

function QuickStatCard({ stat, index }: { stat: typeof quickStats[number]; index: number }) {
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

function ActivityTimeline() {
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
              {recentActivity.map((event, i) => {
                const EventIcon = event.icon;
                return (
                  <motion.div
                    key={i}
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
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AlertCards() {
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
              <CardDescription className="text-xs">{activeAlerts.length} alerts require attention</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
            {activeAlerts.filter(a => a.severity === 'critical').length} Critical
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[440px] pr-3 -mr-3">
          <div className="space-y-2">
            {activeAlerts.map((alert, i) => {
              const AlertIcon = alert.icon;
              const styles = severityStyles[alert.severity];
              return (
                <motion.div
                  key={i}
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
            })}
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
          setData(result.data.commandCenter);
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
          <ActivityTimeline />
        </motion.div>
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <AlertCards />
        </motion.div>
      </motion.div>
    </div>
  );
}
