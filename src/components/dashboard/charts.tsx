'use client';

import React from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
  occupancy: number;
}

interface OccupancyData {
  name: string;
  value: number;
}

interface BookingSourceData {
  source: string;
  bookings: number;
}

interface HourlyActivityData {
  hour: string;
  checkins: number;
  checkouts: number;
}

interface ChartData {
  revenue: RevenueData[];
  occupancyByRoomType: OccupancyData[];
  bookingSources: BookingSourceData[];
  hourlyActivity: HourlyActivityData[];
}

// ──────────────────────────────────────────────
// Color Palette — teal / emerald / cyan / amber
// ──────────────────────────────────────────────

const BRAND = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  cyan: '#06b6d4',
  cyanDark: '#0891b2',
  amber: '#f59e0b',
  amberDark: '#d97706',
  teal: '#14b8a6',
  tealDark: '#0d9488',
} as const;

const chartColors = [
  BRAND.emerald,
  BRAND.cyan,
  BRAND.amber,
  BRAND.teal,
  '#34d399', // emerald-400
  '#22d3ee', // cyan-400
] as const;

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: BRAND.emerald,
  },
  bookings: {
    label: 'Bookings',
    color: BRAND.cyan,
  },
  occupancy: {
    label: 'Occupancy',
    color: BRAND.amber,
  },
  checkins: {
    label: 'Check-ins',
    color: BRAND.emerald,
  },
  checkouts: {
    label: 'Check-outs',
    color: BRAND.amber,
  },
} satisfies ChartConfig;

// ──────────────────────────────────────────────
// Glassmorphism tooltip className override
// ──────────────────────────────────────────────

const GLASS_TOOLTIP =
  'backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-white/25 dark:border-white/10 rounded-xl shadow-xl shadow-black/[0.04] dark:shadow-black/20 text-[13px]';

// ──────────────────────────────────────────────
// Shared hook: fetches dashboard data once
// ──────────────────────────────────────────────

function useDashboardData() {
  const [data, setData] = React.useState<ChartData | null>(null);
  const [revenueChange, setRevenueChange] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data.charts);
        setRevenueChange(result.data.stats.revenue.change);
      } else {
        setError('Failed to load chart data');
      }
    } catch (err) {
      setError('Failed to load chart data');
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, revenueChange, isLoading, error, refetch: fetchData };
}

// ──────────────────────────────────────────────
// Empty state component
// ──────────────────────────────────────────────

function ChartEmptyState({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center px-4 py-8">
      <div className="rounded-full bg-muted/50 p-3 mb-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">No data available</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        {title} will appear here once data is collected
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────
// Skeleton / Error states
// ──────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="h-[280px] w-full flex items-center justify-center">
      <div className="space-y-3 w-full px-4">
        <Skeleton className="h-4 w-3/4 mx-auto rounded-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-4 w-1/2 mx-auto rounded-full" />
      </div>
    </div>
  );
}

function ChartsError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">
        Failed to load chart data
      </p>
      <p className="text-xs text-muted-foreground/60 mb-4">Please try again</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5 rounded-full"
        >
          <Loader2 className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

function ChartsSkeletonGrid() {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      {/* Revenue skeleton — 2 cols */}
      <div className="lg:col-span-2">
        <ChartCard>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-5 w-32 mb-1.5 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </ChartCard>
      </div>

      {/* Occupancy skeleton — 1 col */}
      <div>
        <ChartCard>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40 mb-1.5 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[200px] w-full flex items-center justify-center">
              <div className="space-y-3 w-full px-4">
                {[65, 45, 80, 55].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 shrink-0 rounded" />
                    <Skeleton
                      className="h-5 rounded-full"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </ChartCard>
      </div>

      {/* Hourly activity skeleton — 2 cols */}
      <div className="lg:col-span-2">
        <ChartCard>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-5 w-32 mb-1.5 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[200px] w-full flex items-end justify-center gap-2 px-6 pb-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1.5">
                  <Skeleton
                    className="w-full rounded-t-md"
                    style={{ height: `${30 + Math.random() * 55}%` }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </ChartCard>
      </div>

      {/* Pie skeleton — 1 col */}
      <div>
        <ChartCard>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32 mb-1.5 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[200px] w-full flex items-center justify-center">
              <Skeleton className="h-36 w-36 rounded-full" />
            </div>
          </CardContent>
        </ChartCard>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Shared ChartCard wrapper with hover transition
// ──────────────────────────────────────────────

function ChartCard({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        'border border-border/40 shadow-sm',
        'bg-card/80 backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        'hover:shadow-lg hover:border-border/60',
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

// ──────────────────────────────────────────────
// Revenue Chart (Area)
// ──────────────────────────────────────────────

export function RevenueChart({
  data,
  change,
}: {
  data: RevenueData[];
  change: number | null;
}) {
  const { currency } = useCurrency();
  const isPositive = change != null && change >= 0;

  if (!data || data.length === 0) {
    return (
      <ChartCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Revenue Overview
          </CardTitle>
          <CardDescription className="text-xs">
            Weekly performance
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartEmptyState title="Revenue trends" />
        </CardContent>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            Revenue Overview
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Weekly performance
          </CardDescription>
        </div>
        {change != null && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 text-xs gap-1.5 rounded-full font-medium transition-colors',
              isPositive
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/60 dark:hover:bg-emerald-950'
                : 'text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/60 dark:hover:bg-red-950',
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {isPositive ? '+' : ''}
            {change}%
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {/* Multi-stop gradient under the area line */}
              <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND.emerald} stopOpacity={0.35} />
                <stop offset="40%" stopColor={BRAND.emerald} stopOpacity={0.12} />
                <stop offset="100%" stopColor={BRAND.emerald} stopOpacity={0} />
              </linearGradient>
              {/* Glow filter for the active dot */}
              <filter id="glowRevenue" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid
              strokeDasharray="4 8"
              vertical={false}
              className="stroke-muted/25"
            />
            <XAxis
              dataKey="date"
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              dx={-4}
              tickFormatter={(v) => `${currency.symbol}${v / 1000}k`}
            />
            <ChartTooltip
              content={<ChartTooltipContent className={GLASS_TOOLTIP} />}
              cursor={{
                stroke: 'hsl(var(--muted-foreground))',
                strokeWidth: 1,
                strokeDasharray: '4 4',
                opacity: 0.25,
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={BRAND.emerald}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradientRevenue)"
              animationDuration={1200}
              animationEasing="ease-out"
              activeDot={{
                r: 5,
                strokeWidth: 2.5,
                stroke: 'hsl(var(--background))',
                fill: BRAND.emerald,
                filter: 'url(#glowRevenue)',
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Occupancy Chart (Horizontal Bar)
// ──────────────────────────────────────────────

export function OccupancyChart({ data }: { data: OccupancyData[] }) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }));

  if (!data || data.length === 0) {
    return (
      <ChartCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Occupancy by Room Type
          </CardTitle>
          <CardDescription className="text-xs">
            Current occupancy percentage
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartEmptyState title="Occupancy breakdown" />
        </CardContent>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight">
          Occupancy by Room Type
        </CardTitle>
        <CardDescription className="text-xs mt-0.5">
          Current occupancy percentage
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 80, right: 16 }}
          >
            <defs>
              {chartData.map((entry, index) => (
                <linearGradient
                  key={`occGrad${index}`}
                  id={`occGrad${index}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="4 8"
              className="stroke-muted/25"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              dy={8}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              dataKey="name"
              type="category"
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <ChartTooltip
              content={<ChartTooltipContent className={GLASS_TOOLTIP} />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
            />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              maxBarSize={24}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#occGrad${index})`}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Booking Sources Chart (Pie / Donut)
// ──────────────────────────────────────────────

export function BookingSourceChart({ data }: { data: BookingSourceData[] }) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }));

  if (!data || data.length === 0) {
    return (
      <ChartCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Booking Sources
          </CardTitle>
          <CardDescription className="text-xs">
            Distribution by channel
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartEmptyState title="Booking sources" />
        </CardContent>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight">
          Booking Sources
        </CardTitle>
        <CardDescription className="text-xs mt-0.5">
          Distribution by channel
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <PieChart>
            <defs>
              {/* Drop shadow for the donut */}
              <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="4"
                  floodColor="hsl(var(--foreground))"
                  floodOpacity="0.08"
                />
              </filter>
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              dataKey="bookings"
              nameKey="source"
              paddingAngle={3}
              strokeWidth={2.5}
              stroke="hsl(var(--background))"
              animationDuration={1000}
              animationEasing="ease-out"
              filter="url(#pieShadow)"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  className="cursor-pointer transition-all duration-200 hover:brightness-110 hover:scale-[1.03] origin-center"
                />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent className={GLASS_TOOLTIP} />}
            />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 justify-center px-2">
          {chartData.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div
                className="h-2.5 w-2.5 rounded-full ring-2 ring-background shadow-sm"
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-xs text-muted-foreground font-medium">
                {item.source}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Hourly Activity Chart (Grouped Bar)
// ──────────────────────────────────────────────

export function HourlyActivityChart({ data }: { data: HourlyActivityData[] }) {
  if (!data || data.length === 0) {
    return (
      <ChartCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Today&apos;s Activity
          </CardTitle>
          <CardDescription className="text-xs">
            Check-ins vs Check-outs by hour
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartEmptyState title="Today's activity" />
        </CardContent>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            Today&apos;s Activity
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Check-ins vs Check-outs by hour
          </CardDescription>
        </div>
        {/* Inline legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: BRAND.emerald }}
            />
            <span className="text-muted-foreground">Check-ins</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: BRAND.amber }}
            />
            <span className="text-muted-foreground">Check-outs</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradCheckins" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND.emerald} stopOpacity={1} />
                <stop offset="100%" stopColor={BRAND.tealDark} stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="gradCheckouts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND.amber} stopOpacity={1} />
                <stop offset="100%" stopColor={BRAND.amberDark} stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 8"
              className="stroke-muted/25"
              vertical={false}
            />
            <XAxis
              dataKey="hour"
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              className="text-[11px]"
              tickLine={false}
              axisLine={false}
              dx={-4}
            />
            <ChartTooltip
              content={<ChartTooltipContent className={GLASS_TOOLTIP} />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.25 }}
            />
            <Bar
              dataKey="checkins"
              name="Check-ins"
              fill="url(#gradCheckins)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={1000}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="checkouts"
              name="Check-outs"
              fill="url(#gradCheckouts)"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              animationDuration={1000}
              animationEasing="ease-out"
              animationBegin={200}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </ChartCard>
  );
}

// ──────────────────────────────────────────────
// Main DashboardCharts export
// ──────────────────────────────────────────────

export function DashboardCharts() {
  const { data, revenueChange, isLoading, error, refetch } = useDashboardData();

  if (isLoading) return <ChartsSkeletonGrid />;
  if (error || !data) return <ChartsError onRetry={refetch} />;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {/* Revenue — 2 cols */}
      <div className="md:col-span-2 lg:col-span-2">
        <RevenueChart data={data.revenue} change={revenueChange} />
      </div>

      {/* Occupancy — 1 col */}
      <div>
        <OccupancyChart data={data.occupancyByRoomType} />
      </div>

      {/* Hourly Activity — 2 cols */}
      <div className="md:col-span-2 lg:col-span-2">
        <HourlyActivityChart data={data.hourlyActivity} />
      </div>

      {/* Booking Sources — 1 col */}
      <div>
        <BookingSourceChart data={data.bookingSources} />
      </div>
    </div>
  );
}
