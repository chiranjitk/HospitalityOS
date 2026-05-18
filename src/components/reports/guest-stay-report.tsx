'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
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
  Users,
  Calendar,
  Moon,
  DollarSign,
  Clock,
  TrendingUp,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Search,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  Crown,
  Shield,
  Medal,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building2,
  BedDouble,
  BarChart3,
  Filter,
  X,
  XCircle,
  Printer,
  CalendarClock,
  Columns3,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  PieChart as PieChartIcon,
  Clock4,
  Wallet,
  Banknote,
  Smartphone,
  ArrowUpDown,
} from 'lucide-react';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
type PaymentStatus = 'paid' | 'pending' | 'partial' | 'refunded' | 'overdue';
type BookingSource = 'direct' | 'booking_com' | 'expedia' | 'airbnb' | 'walk_in' | 'phone' | 'corporate' | 'ota';

interface FolioLineItemDetail {
  id: string;
  folioNumber: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: string | null;
}

interface PaymentDetail {
  id: string;
  folioNumber: string;
  amount: number | null;
  method: string;
  status: string;
  gateway: string | null;
  cardType: string | null;
  cardLast4: string | null;
  currency: string;
  processedAt: string | null;
  createdAt: string | null;
}

interface GuestFeedbackDetail {
  id: string;
  type: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  resolvedAt: string | null;
  createdAt: string | null;
}

interface GuestReviewDetail {
  id: string;
  overallRating: number;
  cleanlinessRating: number | null;
  serviceRating: number | null;
  locationRating: number | null;
  valueRating: number | null;
  title: string | null;
  comment: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  createdAt: string | null;
}

interface GuestStayRecord {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  nationality: string;
  isVIP: boolean;
  loyaltyTier: LoyaltyTier | null;
  confirmationCode: string;
  propertyName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomRate: number;
  taxes: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  source: BookingSource;
  // Extended detail fields
  guestId?: string;
  address?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  idType?: string;
  idNumber?: string;
  specialRequests?: string;
  folioNumber?: string;
  paymentMethod?: string;
  paidAmount?: number;
  outstandingAmount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  adults?: number;
  children?: number;
  roomTypeId?: string;
  propertyId?: string;
  bookingId?: string;
  // NEW extended data
  allFolioLineItems: FolioLineItemDetail[];
  allPayments: PaymentDetail[];
  guestFeedbacks: GuestFeedbackDetail[];
  guestReviews: GuestReviewDetail[];
}

interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
  bookings: number;
}

interface NationalityDistribution {
  country: string;
  guests: number;
  percentage: number;
}

interface StatusDistribution {
  status: string;
  count: number;
}

interface RoomTypeRevenue {
  roomType: string;
  revenue: number;
  bookings: number;
}

interface SourceRevenue {
  source: string;
  revenue: number;
  bookings: number;
  roomNights: number;
}

interface CancellationAnalysis {
  cancelled: number;
  noShow: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
}

interface RepeatGuestAnalysis {
  firstTime: { guests: number; revenue: number };
  repeat: { guests: number; revenue: number };
}

// Enhancement 3: Extended Cancellation Analysis
interface CancellationAnalysisExtended {
  cancellationRate: number;
  byReason: Array<{ reason: string; count: number; percentage: number }>;
  byLeadTimeBucket: Array<{ bucket: string; cancelled: number; total: number; rate: number }>;
  monthlyTrend: Array<{ month: string; rate: number; count: number }>;
  avgRiskScore: { cancelled: number; nonCancelled: number };
}

// Enhancement 4: Revenue Breakdown
interface RevenueBreakdown {
  byCategory: Array<{ category: string; amount: number; percentage: number }>;
  byCategoryByMonth: Array<{
    month: string;
    [category: string]: string | number;
  }>;
}

// Enhancement 5: Guest Lifetime Value
interface GuestLifetimeValue {
  guestId: string;
  guestName: string;
  totalSpent: number;
  totalStays: number;
  totalNights: number;
  avgPerStay: number;
  firstStay: string;
  lastStay: string;
}

// Enhancement 6: Lead Time Analysis
interface LeadTimeAnalysis {
  averageLeadTime: number;
  medianLeadTime: number;
  distribution: Array<{ bucket: string; count: number; percentage: number }>;
  bySource: Array<{ source: string; avgLeadTime: number; medianLeadTime: number }>;
  cancellationCorrelation: {
    sameDayCancellationRate: number;
    advanceCancellationRate: number;
    correlation: number;
  };
}

interface GuestStayReportData {
  records: GuestStayRecord[];
  summary: {
    totalGuests: number;
    totalStays: number;
    totalRoomNights: number;
    totalRevenue: number;
    avgStayLength: number;
    avgRevenuePerStay: number;
    cancellationRate: number;
    cancelledStays: number;
    cancelledRevenue: number;
    noShowCount: number;
    totalOutstanding: number;
    totalCollected: number;
    collectionRate: number;
    repeatGuestCount: number;
    firstTimeGuestCount: number;
    repeatGuestRevenue: number;
    firstTimeGuestRevenue: number;
    adr: number;
    revpar: number;
    averageRating: number | null;
    totalReviews: number;
  };
  charts: {
    monthlyRevenue: MonthlyRevenuePoint[];
    nationalityDistribution: NationalityDistribution[];
    bookingStatusDistribution: StatusDistribution[];
    revenueByRoomType: RoomTypeRevenue[];
    revenueBySource: SourceRevenue[];
    cancellationAnalysis: CancellationAnalysis;
    repeatGuestAnalysis: RepeatGuestAnalysis;
  };
  // Enhancement fields - optional for backward compatibility
  cancellationAnalysis?: CancellationAnalysisExtended;
  revenueBreakdown?: RevenueBreakdown;
  guestLifetimeValue?: GuestLifetimeValue[];
  leadTimeAnalysis?: LeadTimeAnalysis;
  comparisonData?: {
    summary: GuestStayReportData['summary'];
  };
}

interface Property {
  id: string;
  name: string;
}

interface Filters {
  startDate: Date;
  endDate: Date;
  propertyId: string;
  bookingStatus: string;
  loyaltyTier: string;
  vipOnly: boolean;
  search: string;
  bookingSource: string;
  // Enhancement 2: Comparison
  compareStartDate?: Date;
  compareEndDate?: Date;
  enableComparison?: boolean;
}

// Enhancement 7: Scheduled Report
interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  timezone: string;
  format: 'xlsx' | 'csv' | 'pdf';
  recipients: string[];
  active: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

// Enhancement 8: Column Selection
type ColumnKey =
  | 'guestName' | 'email' | 'phone' | 'nationality' | 'isVIP'
  | 'loyaltyTier' | 'confirmationCode' | 'propertyName' | 'roomNumber'
  | 'roomType' | 'checkIn' | 'checkOut' | 'nights' | 'roomRate'
  | 'taxes' | 'totalAmount' | 'status' | 'paymentStatus' | 'source'
  | 'folioNumber' | 'paymentMethod';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  essential: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'guestName', label: 'Guest Name', essential: true },
  { key: 'email', label: 'Email', essential: false },
  { key: 'phone', label: 'Phone', essential: false },
  { key: 'nationality', label: 'Nationality', essential: true },
  { key: 'isVIP', label: 'VIP', essential: true },
  { key: 'loyaltyTier', label: 'Loyalty Tier', essential: true },
  { key: 'confirmationCode', label: 'Confirmation Code', essential: true },
  { key: 'propertyName', label: 'Property', essential: true },
  { key: 'roomNumber', label: 'Room Number', essential: true },
  { key: 'roomType', label: 'Room Type', essential: true },
  { key: 'checkIn', label: 'Check-In', essential: true },
  { key: 'checkOut', label: 'Check-Out', essential: true },
  { key: 'nights', label: 'Nights', essential: true },
  { key: 'roomRate', label: 'Room Rate', essential: false },
  { key: 'taxes', label: 'Taxes', essential: false },
  { key: 'totalAmount', label: 'Total Amount', essential: true },
  { key: 'status', label: 'Status', essential: true },
  { key: 'paymentStatus', label: 'Payment Status', essential: true },
  { key: 'source', label: 'Source', essential: true },
  { key: 'folioNumber', label: 'Folio #', essential: false },
  { key: 'paymentMethod', label: 'Payment Method', essential: false },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(c => c.essential).map(c => c.key);

type SortField = keyof GuestStayRecord;
type SortDirection = 'asc' | 'desc';

// Enhancement 9: Drilldown filter
interface DrilldownFilter {
  field: string;
  value: string;
}

// ============================================================================
// Constants
// ============================================================================

const chartConfig = {
  revenue: { label: 'Revenue', color: '#10b981' },
  bookings: { label: 'Bookings', color: '#f59e0b' },
  guests: { label: 'Guests', color: '#8b5cf6' },
  count: { label: 'Count', color: '#06b6d4' },
  amount: { label: 'Amount', color: '#10b981' },
  rate: { label: 'Rate', color: '#f43f5e' },
  cancelled: { label: 'Cancelled', color: '#f43f5e' },
  nonCancelled: { label: 'Non-cancelled', color: '#10b981' },
} satisfies ChartConfig;

const chartColors = [
  '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#14b8a6',
];

const BOOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

const LOYALTY_TIER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
];

const BOOKING_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'ota', label: 'OTA' },
];

const QUICK_RANGES: { label: string; days: number }[] = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 1 Year', days: 365 },
  { label: 'All Time', days: 0 },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const statusBadgeVariants: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  checked_in: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  checked_out: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  no_show: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
};

const paymentBadgeVariants: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  partial: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  refunded: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bronze: Medal,
  silver: Shield,
  gold: Star,
  platinum: Crown,
};

const tierBadgeVariants: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  silver: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  platinum: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
};

const COLUMNS_STORAGE_KEY = 'guestStayReport_columns';

const DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const TIMEZONE_OPTIONS = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const PAYMENT_METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Building2,
  wallet: Wallet,
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatCurrencyValue(value: number, symbol: string): string {
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateSafe(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : dateStr;
  } catch {
    return dateStr;
  }
}

function formatMonthLabel(monthStr: string): string {
  try {
    const date = parseISO(monthStr + '-01');
    return isValid(date) ? format(date, 'MMM yyyy') : monthStr;
  } catch {
    return monthStr;
  }
}

function getPercentageChange(current: number, previous: number): { change: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { change: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'neutral' };
  const pct = ((current - previous) / previous) * 100;
  return { change: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

function loadVisibleColumns(): ColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS;
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_VISIBLE_COLUMNS;
}

function saveVisibleColumns(columns: ColumnKey[]) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch { /* ignore */ }
}

// ============================================================================
// Sub-Components
// ============================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('border-0 shadow-sm rounded-xl', gradient)}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium truncate', iconColor)}>{title}</p>
              <p className="text-2xl font-bold mt-1 truncate">{value}</p>
              {subtitle && (
                <p className={cn('text-xs mt-1 truncate', iconColor)}>{subtitle}</p>
              )}
            </div>
            <div className={cn('p-3 rounded-full shrink-0 ml-3', iconBg)}>
              <Icon className={cn('h-6 w-6', iconColor)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium', statusBadgeVariants[status])}>
      {formatStatusLabel(status)}
    </Badge>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium', paymentBadgeVariants[status])}>
      {formatStatusLabel(status)}
    </Badge>
  );
}

function LoyaltyTierBadge({ tier }: { tier: LoyaltyTier | null }) {
  if (!tier) return <span className="text-muted-foreground text-xs">&mdash;</span>;
  const TierIcon = tierIcons[tier];
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium gap-1', tierBadgeVariants[tier])}>
      {TierIcon && <TierIcon className="h-3 w-3" />}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function VIPBadge({ isVIP }: { isVIP: boolean }) {
  if (!isVIP) return <span className="text-muted-foreground text-xs">&mdash;</span>;
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-medium gap-1">
      <Crown className="h-3 w-3" />
      VIP
    </Badge>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right ml-4">{value || '\u2014'}</span>
    </div>
  );
}

// Enhancement 2: Comparison Metric Card
function ComparisonMetricCard({
  label,
  current,
  previous,
  formatFn,
}: {
  label: string;
  current: number;
  previous: number;
  formatFn?: (v: number) => string;
}) {
  const { change, direction } = getPercentageChange(current, previous);
  const fmt = formatFn || ((v: number) => v.toLocaleString());
  return (
    <Card className="border-0 shadow-sm rounded-xl bg-muted/30">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="flex items-end gap-3">
          <div>
            <p className="text-lg font-bold">{fmt(current)}</p>
            <p className="text-xs text-muted-foreground">vs {fmt(previous)}</p>
          </div>
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
            direction === 'up' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
            direction === 'down' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
            direction === 'neutral' && 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
          )}>
            {direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {change.toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Detail Dialog Component
// ============================================================================

function GuestDetailDialog({
  record,
  open,
  onOpenChange,
  currencySymbol,
}: {
  record: GuestStayRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencySymbol: string;
}) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-500" />
            Guest Stay Details
          </DialogTitle>
          <DialogDescription>
            Complete information for booking {record.confirmationCode}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="booking">Booking</TabsTrigger>
              <TabsTrigger value="folio">Folio</TabsTrigger>
              <TabsTrigger value="stay">Stay</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                  {record.guestName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{record.guestName}</h3>
                    {record.isVIP && <VIPBadge isVIP />}
                    <LoyaltyTierBadge tier={record.loyaltyTier} />
                  </div>
                  <p className="text-sm text-muted-foreground">{record.confirmationCode}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <InfoRow label="Email" value={<span className="flex items-center gap-1"><Mail className="h-3 w-3" />{record.email}</span>} />
                <InfoRow label="Phone" value={<span className="flex items-center gap-1"><Phone className="h-3 w-3" />{record.phone}</span>} />
                <InfoRow label="Nationality" value={<span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{record.nationality}</span>} />
                {record.address && <InfoRow label="Address" value={record.address} />}
                {record.city && <InfoRow label="City" value={record.city} />}
                {record.country && <InfoRow label="Country" value={record.country} />}
                {record.dateOfBirth && <InfoRow label="Date of Birth" value={formatDateSafe(record.dateOfBirth)} />}
                {record.idType && <InfoRow label="ID Type" value={record.idType} />}
                {record.idNumber && <InfoRow label="ID Number" value={record.idNumber} />}
              </div>
              {record.specialRequests && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1">Special Requests</p>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{record.specialRequests}</p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="booking" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                      {record.propertyName}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-0">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Room</p>
                    <p className="font-medium flex items-center gap-1 mt-1">
                      <BedDouble className="h-3.5 w-3.5 text-amber-500" />
                      {record.roomNumber} &mdash; {record.roomType}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Separator />
              <div className="space-y-1">
                <InfoRow label="Confirmation Code" value={<span className="font-mono">{record.confirmationCode}</span>} />
                <InfoRow label="Status" value={<StatusBadge status={record.status} />} />
                <InfoRow label="Source" value={formatStatusLabel(record.source)} />
                <InfoRow label="Check-In" value={formatDateSafe(record.checkIn)} />
                <InfoRow label="Check-Out" value={formatDateSafe(record.checkOut)} />
                <InfoRow label="Duration" value={`${record.nights} night${record.nights !== 1 ? 's' : ''}`} />
                {record.adults !== undefined && <InfoRow label="Adults" value={String(record.adults)} />}
                {record.children !== undefined && <InfoRow label="Children" value={String(record.children)} />}
              </div>
            </TabsContent>

            <TabsContent value="folio" className="space-y-4 mt-4">
              <div className="space-y-1">
                {record.folioNumber && <InfoRow label="Folio Number" value={<span className="font-mono">{record.folioNumber}</span>} />}
                <InfoRow label="Room Rate / Night" value={formatCurrencyValue(record.roomRate, currencySymbol)} />
                <InfoRow label="Total Room Charges" value={formatCurrencyValue(record.roomRate * record.nights, currencySymbol)} />
                <InfoRow label="Taxes & Fees" value={formatCurrencyValue(record.taxes, currencySymbol)} />
                <Separator className="my-2" />
                <InfoRow label="Total Amount" value={<span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyValue(record.totalAmount, currencySymbol)}</span>} />
                <InfoRow label="Payment Status" value={<PaymentStatusBadge status={record.paymentStatus} />} />
                {record.paymentMethod && <InfoRow label="Payment Method" value={<span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{record.paymentMethod}</span>} />}
                {record.paidAmount !== undefined && (
                  <InfoRow label="Paid Amount" value={formatCurrencyValue(record.paidAmount, currencySymbol)} />
                )}
                {record.outstandingAmount !== undefined && record.outstandingAmount > 0 && (
                  <InfoRow label="Outstanding" value={<span className="text-red-600 dark:text-red-400 font-medium">{formatCurrencyValue(record.outstandingAmount, currencySymbol)}</span>} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="stay" className="space-y-4 mt-4">
              <div className="space-y-1">
                <InfoRow label="Scheduled Check-In" value={formatDateSafe(record.checkIn)} />
                <InfoRow label="Scheduled Check-Out" value={formatDateSafe(record.checkOut)} />
                {record.actualCheckIn && <InfoRow label="Actual Check-In" value={formatDateSafe(record.actualCheckIn)} />}
                {record.actualCheckOut && <InfoRow label="Actual Check-Out" value={formatDateSafe(record.actualCheckOut)} />}
                <InfoRow label="Total Nights" value={`${record.nights} night${record.nights !== 1 ? 's' : ''}`} />
                <InfoRow label="Room Type" value={record.roomType} />
                <InfoRow label="Room Number" value={record.roomNumber} />
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4">
              {record.allPayments && record.allPayments.length > 0 ? (
                <div className="space-y-2">
                  {record.allPayments.map((p) => (
                    <Card key={p.id} className="bg-muted/30 border-0">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{formatStatusLabel(p.method)}</p>
                            <p className="text-xs text-muted-foreground">
                              Folio: {p.folioNumber} &bull; {p.gateway && `${p.gateway} \u2022 `}{p.cardType && `${p.cardType} `}
                              {p.cardLast4 && `****${p.cardLast4}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{formatCurrencyValue(p.amount ?? 0, currencySymbol)}</p>
                            <PaymentStatusBadge status={(p.status as PaymentStatus) || 'pending'} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No payment records found</p>
              )}

              {record.allFolioLineItems && record.allFolioLineItems.length > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-medium">Folio Line Items</p>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {record.allFolioLineItems.map((li) => (
                          <TableRow key={li.id}>
                            <TableCell className="text-xs py-1">{li.description}</TableCell>
                            <TableCell className="text-xs py-1">{li.category}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{li.quantity}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{formatCurrencyValue(li.totalAmount, currencySymbol)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4 mt-4">
              {record.guestReviews && record.guestReviews.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Reviews</p>
                  {record.guestReviews.map((rv) => (
                    <Card key={rv.id} className="bg-muted/30 border-0">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={cn('h-3 w-3', s <= rv.overallRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDateSafe(rv.createdAt ?? '')}</span>
                          {rv.sentimentLabel && (
                            <Badge variant="secondary" className={cn('text-xs', rv.sentimentLabel === 'positive' ? 'bg-emerald-100 text-emerald-700' : rv.sentimentLabel === 'negative' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                              {rv.sentimentLabel}
                            </Badge>
                          )}
                        </div>
                        {rv.title && <p className="text-sm font-medium">{rv.title}</p>}
                        {rv.comment && <p className="text-xs text-muted-foreground">{rv.comment}</p>}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {rv.cleanlinessRating && <span>Cleanliness: {rv.cleanlinessRating}/5</span>}
                          {rv.serviceRating && <span>Service: {rv.serviceRating}/5</span>}
                          {rv.locationRating && <span>Location: {rv.locationRating}/5</span>}
                          {rv.valueRating && <span>Value: {rv.valueRating}/5</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {record.guestFeedbacks && record.guestFeedbacks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Feedback</p>
                  {record.guestFeedbacks.map((fb) => (
                    <Card key={fb.id} className="bg-muted/30 border-0">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={cn('text-xs', fb.type === 'complaint' ? 'bg-red-100 text-red-700' : fb.type === 'suggestion' ? 'bg-cyan-100 text-cyan-700' : 'bg-emerald-100 text-emerald-700')}>
                            {fb.type}
                          </Badge>
                          <Badge variant="secondary" className={cn('text-xs', fb.priority === 'high' ? 'bg-red-100 text-red-700' : fb.priority === 'low' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700')}>
                            {fb.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{fb.status}</span>
                        </div>
                        <p className="text-sm font-medium">{fb.subject}</p>
                        <p className="text-xs text-muted-foreground">{fb.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {(!record.guestReviews || record.guestReviews.length === 0) && (!record.guestFeedbacks || record.guestFeedbacks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No feedback or reviews found for this guest</p>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SortableHeader({
  field,
  children,
  sortField,
  sortDirection,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>
    </TableHead>
  );
}

// Enhancement 7: Schedule Report Dialog
function ScheduleReportDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [time, setTime] = useState('09:00');
  const [timezone, setTimezone] = useState('UTC');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Please enter a report name'); return; }
    if (!recipients.trim()) { toast.error('Please enter at least one recipient'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          frequency,
          dayOfWeek: frequency === 'weekly' ? Number(dayOfWeek) : undefined,
          dayOfMonth: frequency === 'monthly' ? Number(dayOfMonth) : undefined,
          time,
          timezone,
          format: exportFormat,
          recipients: recipients.split(',').map(e => e.trim()).filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error('Failed to create schedule');
      toast.success('Report scheduled successfully');
      setName(''); setRecipients(''); setFrequency('weekly'); setTime('09:00');
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('Failed to schedule report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-emerald-500" />
            Schedule Report
          </DialogTitle>
          <DialogDescription>Set up an automated report schedule</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Report Name</Label>
            <Input className="mt-1 h-8 text-sm" placeholder="Weekly Guest Stay Report" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Frequency</Label>
              <Select value={frequency} onValueChange={v => setFrequency(v as 'daily' | 'weekly' | 'monthly')}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Format</Label>
              <Select value={exportFormat} onValueChange={v => setExportFormat(v as 'xlsx' | 'csv' | 'pdf')}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {frequency === 'weekly' && (
            <div>
              <Label className="text-xs font-medium">Day of Week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div>
              <Label className="text-xs font-medium">Day of Month</Label>
              <Input className="mt-1 h-8 text-sm" type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Time (HH:mm)</Label>
              <Input className="mt-1 h-8 text-sm" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Recipients (comma-separated emails)</Label>
            <Input className="mt-1 h-8 text-sm" placeholder="john@hotel.com, jane@hotel.com" value={recipients} onChange={e => setRecipients(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function GuestStayReport() {
  const { formatCurrency, currency } = useCurrency();

  // ---- State ----
  const [data, setData] = useState<GuestStayReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    propertyId: 'all',
    bookingStatus: 'all',
    loyaltyTier: 'all',
    vipOnly: false,
    search: '',
    bookingSource: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...filters });
  const [activeQuickRange, setActiveQuickRange] = useState(30);

  // Table state
  const [sortField, setSortField] = useState<SortField>('checkIn');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Detail dialog
  const [detailRecord, setDetailRecord] = useState<GuestStayRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Enhancement 2: Comparison state
  const [compareData, setCompareData] = useState<GuestStayReportData | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Enhancement 7: Scheduled reports state
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [viewSchedulesOpen, setViewSchedulesOpen] = useState(false);

  // Enhancement 8: Column selection state
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns);

  // Enhancement 9: Drilldown filter
  const [drilldownFilter, setDrilldownFilter] = useState<DrilldownFilter | null>(null);

  // ---- Data Fetching ----
  const fetchData = useCallback(async (activeFilters: Filters) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: activeFilters.startDate.toISOString(),
        endDate: activeFilters.endDate.toISOString(),
        propertyId: activeFilters.propertyId,
        bookingStatus: activeFilters.bookingStatus,
        loyaltyTier: activeFilters.loyaltyTier,
        vipOnly: String(activeFilters.vipOnly),
        search: activeFilters.search,
        bookingSource: activeFilters.bookingSource,
      });
      if (activeFilters.enableComparison && activeFilters.compareStartDate && activeFilters.compareEndDate) {
        params.set('compareStartDate', activeFilters.compareStartDate.toISOString());
        params.set('compareEndDate', activeFilters.compareEndDate.toISOString());
      }
      const response = await fetch(`/api/reports/guest-stay-report?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load report data');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Load comparison data if enabled
        if (activeFilters.enableComparison && activeFilters.compareStartDate && activeFilters.compareEndDate) {
          try {
            const compParams = new URLSearchParams({
              startDate: activeFilters.compareStartDate.toISOString(),
              endDate: activeFilters.compareEndDate.toISOString(),
              propertyId: activeFilters.propertyId,
              bookingStatus: activeFilters.bookingStatus,
              loyaltyTier: activeFilters.loyaltyTier,
              vipOnly: String(activeFilters.vipOnly),
              search: '',
              bookingSource: activeFilters.bookingSource,
            });
            const compResponse = await fetch(`/api/reports/guest-stay-report?${compParams}`);
            if (compResponse.ok) {
              const compResult = await compResponse.json();
              if (compResult.success) setCompareData(compResult.data);
            }
          } catch { /* silently fail */ }
        } else {
          setCompareData(null);
        }
      } else {
        throw new Error(result.error || 'Failed to load report data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      const response = await fetch('/api/properties');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setProperties(result.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch scheduled reports
  const fetchScheduledReports = useCallback(async () => {
    try {
      const response = await fetch('/api/reports/scheduled');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setScheduledReports(result.data);
        }
      }
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchData(appliedFilters);
  }, [appliedFilters, fetchData]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchScheduledReports();
  }, [fetchScheduledReports]);

  // Persist column selection
  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  // ---- Filter Handlers ----
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
    setSelectedRows(new Set());
    setDrilldownFilter(null);
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    const resetState: Filters = {
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      propertyId: 'all',
      bookingStatus: 'all',
      loyaltyTier: 'all',
      vipOnly: false,
      search: '',
      bookingSource: 'all',
    };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setActiveQuickRange(30);
    setCurrentPage(1);
    setSelectedRows(new Set());
    setDrilldownFilter(null);
  }, []);

  const handleQuickRange = useCallback((days: number) => {
    setActiveQuickRange(days);
    const newFilters = {
      ...filters,
      startDate: days === 0 ? new Date('2020-01-01') : subDays(new Date(), days),
      endDate: days === 0 ? new Date('2030-12-31') : new Date(),
    };
    setFilters(newFilters);
    setAppliedFilters(newFilters);
    setCurrentPage(1);
    setSelectedRows(new Set());
    setDrilldownFilter(null);
  }, [filters]);

  // ---- Sorting ----
  const handleSort = useCallback((field: SortField) => {
    setSortDirection(prev => {
      if (sortField === field) {
        return prev === 'asc' ? 'desc' : 'asc';
      }
      return 'asc';
    });
    setSortField(field);
  }, [sortField]);

  // ---- Drilldown filtering ----
  const applyDrilldownFilter = useCallback((field: string, value: string) => {
    setDrilldownFilter({ field, value });
    setCurrentPage(1);
  }, []);

  const clearDrilldownFilter = useCallback(() => {
    setDrilldownFilter(null);
    setCurrentPage(1);
  }, []);

  // Filtered records based on drilldown
  const drilldownFilteredRecords = useMemo(() => {
    if (!data?.records) return [];
    if (!drilldownFilter) return data.records;
    return data.records.filter(r => {
      const val = r[drilldownFilter.field as keyof GuestStayRecord];
      if (drilldownFilter.field === 'month') {
        const checkInMonth = format(parseISO(r.checkIn), 'yyyy-MM');
        return checkInMonth === drilldownFilter.value;
      }
      return String(val) === drilldownFilter.value;
    });
  }, [data, drilldownFilter]);

  const sortedRecords = useMemo(() => {
    const source = drilldownFilter ? drilldownFilteredRecords : (data?.records ?? []);
    const sorted = [...source].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [drilldownFilteredRecords, data, sortField, sortDirection]);

  // ---- Pagination ----
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize);

  // ---- Row Selection ----
  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllRows = useCallback(() => {
    if (selectedRows.size === paginatedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRecords.map(r => r.id)));
    }
  }, [selectedRows.size, paginatedRecords]);

  // ---- Row Click ----
  const handleRowClick = useCallback((record: GuestStayRecord) => {
    setDetailRecord(record);
    setDetailOpen(true);
  }, []);

  // ---- Export ----
  const handleExport = useCallback(async (format: 'csv' | 'xlsx' | 'pdf') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        startDate: appliedFilters.startDate.toISOString(),
        endDate: appliedFilters.endDate.toISOString(),
        propertyId: appliedFilters.propertyId,
        bookingStatus: appliedFilters.bookingStatus,
        loyaltyTier: appliedFilters.loyaltyTier,
        vipOnly: String(appliedFilters.vipOnly),
        search: appliedFilters.search,
        bookingSource: appliedFilters.bookingSource,
      });
      const response = await fetch(`/api/reports/guest-stay-report?${params}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      const ext = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const downloadFilename = filenameMatch?.[1]?.replace(/['"]/g, '') || `guest-stay-report.${ext}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()} successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  }, [appliedFilters]);

  // Enhancement 10: Print
  const handlePrint = useCallback(() => {
    if (!data) return;
    const s = data.summary;
    const propertyName = properties.length === 1 ? properties[0].name : (appliedFilters.propertyId !== 'all' ? properties.find(p => p.id === appliedFilters.propertyId)?.name : 'All Properties');
    const dateRange = `${format(appliedFilters.startDate, 'MMM dd, yyyy')} - ${format(appliedFilters.endDate, 'MMM dd, yyyy')}`;
    const generatedDate = format(new Date(), 'MMM dd, yyyy HH:mm');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Guest Stay Report</title>
        <style>
          @media print { @page { margin: 1cm; } }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 20px; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 22px; margin: 0; color: #10b981; }
          .header .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
          .meta { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 16px; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .summary-table th, .summary-table td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 11px; }
          .summary-table th { background: #f3f4f6; font-weight: 600; }
          .data-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .data-table th, .data-table td { border: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; font-size: 10px; }
          .data-table th { background: #f3f4f6; font-weight: 600; white-space: nowrap; }
          .data-table tr:nth-child(even) { background: #f9fafb; }
          .page-num { text-align: center; font-size: 10px; color: #999; margin-top: 12px; }
          @media print { .page-num { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>StaySuite - Guest Stay Report</h1>
          <div class="subtitle">${propertyName || 'All Properties'}</div>
        </div>
        <div class="meta">
          <span>Date Range: ${dateRange}</span>
          <span>Generated: ${generatedDate}</span>
        </div>
        <table class="summary-table">
          <tr><th>Metric</th><th>Value</th><th>Metric</th><th>Value</th></tr>
          <tr><td>Total Guests</td><td>${s.totalGuests.toLocaleString()}</td><td>Total Revenue</td><td>${formatCurrencyValue(s.totalRevenue, currency.symbol)}</td></tr>
          <tr><td>Total Stays</td><td>${s.totalStays.toLocaleString()}</td><td>Avg Revenue/Stay</td><td>${formatCurrencyValue(s.avgRevenuePerStay, currency.symbol)}</td></tr>
          <tr><td>Total Room Nights</td><td>${s.totalRoomNights.toLocaleString()}</td><td>Cancellation Rate</td><td>${s.cancellationRate}%</td></tr>
          <tr><td>Avg Stay Length</td><td>${s.avgStayLength.toFixed(1)} nights</td><td>ADR</td><td>${formatCurrencyValue(s.adr, currency.symbol)}</td></tr>
          <tr><td>Collection Rate</td><td>${s.collectionRate}%</td><td>RevPAR</td><td>${formatCurrencyValue(s.revpar, currency.symbol)}</td></tr>
        </table>
        <table class="data-table">
          <thead>
            <tr>
              ${visibleColumns.map(k => `<th>${ALL_COLUMNS.find(c => c.key === k)?.label || k}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.records.slice(0, 200).map(r => `<tr>${visibleColumns.map(k => {
              const val = r[k as keyof GuestStayRecord];
              if (k === 'totalAmount' || k === 'roomRate' || k === 'taxes') return `<td>${formatCurrencyValue(val as number, currency.symbol)}</td>`;
              if (k === 'checkIn' || k === 'checkOut') return `<td>${formatDateSafe(val as string)}</td>`;
              if (k === 'isVIP') return `<td>${val ? 'VIP' : '-'}</td>`;
              return `<td>${String(val ?? '')}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div class="page-num">Page 1</div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  }, [data, appliedFilters, properties, visibleColumns, currency.symbol]);

  // Enhancement 1: Payment Summary data
  const paymentSummaryData = useMemo(() => {
    if (!data?.records) return [];
    const methodTotals: Record<string, number> = {};
    data.records.forEach(r => {
      const method = r.paymentMethod || 'unknown';
      if (!methodTotals[method]) methodTotals[method] = 0;
      methodTotals[method] += r.totalAmount;
    });
    return Object.entries(methodTotals).map(([method, amount]) => ({
      method: formatStatusLabel(method),
      amount: Math.round(amount * 100) / 100,
    })).sort((a, b) => b.amount - a.amount);
  }, [data]);

  // Column toggle handler
  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleColumns(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 3) return prev; // Minimum 3 columns
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  // ---- Loading Skeleton ----
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error State ----
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
          <X className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold">Failed to Load Report</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
        <Button variant="outline" className="gap-2" onClick={() => fetchData(appliedFilters)}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const { summary, charts } = data;
  const extCancellation = data.cancellationAnalysis;
  const revBreakdown = data.revenueBreakdown;
  const guestLTV = data.guestLifetimeValue;
  const leadTime = data.leadTimeAnalysis;

  // Column rendering helpers
  const renderCellContent = (record: GuestStayRecord, key: ColumnKey) => {
    switch (key) {
      case 'guestName':
        return (
          <div>
            <p className="font-medium text-sm">{record.guestName}</p>
            <p className="text-xs text-muted-foreground">{record.email}</p>
          </div>
        );
      case 'email': return <span className="text-sm">{record.email}</span>;
      case 'phone': return <span className="text-sm">{record.phone}</span>;
      case 'nationality': return <span className="text-sm">{record.nationality}</span>;
      case 'isVIP': return <VIPBadge isVIP={record.isVIP} />;
      case 'loyaltyTier': return <LoyaltyTierBadge tier={record.loyaltyTier} />;
      case 'confirmationCode': return <span className="font-mono text-xs">{record.confirmationCode}</span>;
      case 'propertyName': return <span className="text-sm">{record.propertyName}</span>;
      case 'roomNumber': return <span className="text-sm font-medium">{record.roomNumber}</span>;
      case 'roomType': return <span className="text-sm">{record.roomType}</span>;
      case 'checkIn': return <span className="text-sm">{formatDateSafe(record.checkIn)}</span>;
      case 'checkOut': return <span className="text-sm">{formatDateSafe(record.checkOut)}</span>;
      case 'nights': return <span className="text-sm text-center">{record.nights}</span>;
      case 'roomRate': return <span className="text-sm">{formatCurrencyValue(record.roomRate, currency.symbol)}</span>;
      case 'taxes': return <span className="text-sm">{formatCurrencyValue(record.taxes, currency.symbol)}</span>;
      case 'totalAmount': return <span className="text-sm font-medium">{formatCurrencyValue(record.totalAmount, currency.symbol)}</span>;
      case 'status': return <StatusBadge status={record.status} />;
      case 'paymentStatus': return <PaymentStatusBadge status={record.paymentStatus} />;
      case 'source': return <span className="text-sm">{formatStatusLabel(record.source)}</span>;
      case 'folioNumber': return <span className="font-mono text-xs">{record.folioNumber || '\u2014'}</span>;
      case 'paymentMethod': return <span className="text-sm">{record.paymentMethod ? formatStatusLabel(record.paymentMethod) : '\u2014'}</span>;
      default: return String(record[key] ?? '');
    }
  };

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Header Section */}
      {/* ================================================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guest Stay Report</h2>
          <p className="text-muted-foreground">
            Comprehensive guest stay analysis with filters and multi-format export
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Enhancement 10: Print Button */}
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} disabled={data.records.length === 0}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {/* Enhancement 7: Schedule Button */}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="h-4 w-4" />
            Schedule
          </Button>
          {/* Enhancement 7: View Schedules */}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setViewSchedulesOpen(true)}>
            <Clock4 className="h-4 w-4" />
            Schedules
          </Button>
          {/* Enhancement 8: Columns Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.includes(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                  className="text-xs"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={exporting || data.records.length === 0}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')} disabled={exporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xlsx')} disabled={exporting}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} disabled={exporting}>
                <File className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Filter Bar (Sticky) */}
      {/* ================================================================== */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border rounded-xl p-4 shadow-sm space-y-3">
        {/* Date Range & Quick Ranges */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground shrink-0">From</Label>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={format(filters.startDate, 'yyyy-MM-dd')}
              onChange={e => {
                const d = parseISO(e.target.value);
                if (isValid(d)) setFilters(prev => ({ ...prev, startDate: d }));
              }}
            />
            <Label className="text-xs font-medium text-muted-foreground shrink-0">To</Label>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={format(filters.endDate, 'yyyy-MM-dd')}
              onChange={e => {
                const d = parseISO(e.target.value);
                if (isValid(d)) setFilters(prev => ({ ...prev, endDate: d }));
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map(qr => (
              <Button
                key={qr.days}
                variant={activeQuickRange === qr.days ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 text-xs px-2.5',
                  activeQuickRange === qr.days && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
                onClick={() => handleQuickRange(qr.days)}
              >
                {qr.label}
              </Button>
            ))}
          </div>

          {/* Enhancement 2: Compare Periods Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="compare-toggle"
              checked={filters.enableComparison || false}
              onCheckedChange={val => setFilters(prev => ({ ...prev, enableComparison: val }))}
            />
            <Label htmlFor="compare-toggle" className="text-xs font-medium cursor-pointer">
              Compare Periods
            </Label>
          </div>
        </div>

        {/* Enhancement 2: Comparison Date Range */}
        {filters.enableComparison && (
          <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
            <ArrowUpDown className="h-4 w-4 text-violet-500 shrink-0" />
            <Label className="text-xs font-medium text-violet-700 dark:text-violet-400 shrink-0">Compare from</Label>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={filters.compareStartDate ? format(filters.compareStartDate, 'yyyy-MM-dd') : ''}
              onChange={e => {
                const d = parseISO(e.target.value);
                if (isValid(d)) setFilters(prev => ({ ...prev, compareStartDate: d }));
              }}
            />
            <Label className="text-xs font-medium text-violet-700 dark:text-violet-400 shrink-0">to</Label>
            <Input
              type="date"
              className="w-36 h-8 text-sm"
              value={filters.compareEndDate ? format(filters.compareEndDate, 'yyyy-MM-dd') : ''}
              onChange={e => {
                const d = parseISO(e.target.value);
                if (isValid(d)) setFilters(prev => ({ ...prev, compareEndDate: d }));
              }}
            />
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <Select
            value={filters.propertyId}
            onValueChange={val => setFilters(prev => ({ ...prev, propertyId: val }))}
          >
            <SelectTrigger className="w-44 h-8 text-sm">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.bookingStatus}
            onValueChange={val => setFilters(prev => ({ ...prev, bookingStatus: val }))}
          >
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.loyaltyTier}
            onValueChange={val => setFilters(prev => ({ ...prev, loyaltyTier: val }))}
          >
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              {LOYALTY_TIER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.bookingSource}
            onValueChange={val => setFilters(prev => ({ ...prev, bookingSource: val }))}
          >
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_SOURCE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              id="vip-toggle"
              checked={filters.vipOnly}
              onCheckedChange={val => setFilters(prev => ({ ...prev, vipOnly: val }))}
            />
            <Label htmlFor="vip-toggle" className="text-xs font-medium cursor-pointer">
              VIP Only
            </Label>
          </div>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search guest name or email..."
              className="pl-8 h-8 text-sm"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApplyFilters}>
              <Filter className="h-3.5 w-3.5" />
              Apply
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleResetFilters}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Enhancement 9: Drilldown Filter Banner */}
      {/* ================================================================== */}
      {drilldownFilter && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            <Filter className="h-3 w-3" />
            Filtered by: {drilldownFilter.field === 'month' ? 'Month' : formatStatusLabel(drilldownFilter.field)} = {drilldownFilter.field === 'month' ? formatMonthLabel(drilldownFilter.value) : formatStatusLabel(drilldownFilter.value)}
            <button onClick={clearDrilldownFilter} className="ml-1 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">{sortedRecords.length} matching records</span>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* Main Tabs Layout */}
      {/* ================================================================== */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm">Data Table</TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs sm:text-sm">Comparison</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
          <TabsTrigger value="guests" className="text-xs sm:text-sm">Guest Value</TabsTrigger>
          <TabsTrigger value="schedules" className="text-xs sm:text-sm">Schedules</TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* Tab 1: Overview */}
        {/* ============================================================== */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Summary Cards Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
            <SummaryCard
              title="Total Guests"
              value={summary.totalGuests.toLocaleString()}
              subtitle="Unique guests"
              icon={Users}
              gradient="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
              iconBg="bg-emerald-200 dark:bg-emerald-800"
              iconColor="text-emerald-700 dark:text-emerald-400"
            />
            <SummaryCard
              title="Total Stays"
              value={summary.totalStays.toLocaleString()}
              subtitle="Booking count"
              icon={Calendar}
              gradient="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900"
              iconBg="bg-amber-200 dark:bg-amber-800"
              iconColor="text-amber-700 dark:text-amber-400"
            />
            <SummaryCard
              title="Total Room Nights"
              value={summary.totalRoomNights.toLocaleString()}
              subtitle="Nights sold"
              icon={Moon}
              gradient="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
              iconBg="bg-violet-200 dark:bg-violet-800"
              iconColor="text-violet-700 dark:text-violet-400"
            />
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              subtitle="Gross revenue"
              icon={DollarSign}
              gradient="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900"
              iconBg="bg-cyan-200 dark:bg-cyan-800"
              iconColor="text-cyan-700 dark:text-cyan-400"
            />
            <SummaryCard
              title="Avg Stay Length"
              value={`${summary.avgStayLength.toFixed(1)} nights`}
              subtitle="Per booking"
              icon={Clock}
              gradient="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900"
              iconBg="bg-pink-200 dark:bg-pink-800"
              iconColor="text-pink-700 dark:text-pink-400"
            />
            <SummaryCard
              title="Avg Revenue/Stay"
              value={formatCurrency(summary.avgRevenuePerStay)}
              subtitle="Per booking"
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
              iconBg="bg-teal-200 dark:bg-teal-800"
              iconColor="text-teal-700 dark:text-teal-400"
            />
            <SummaryCard
              title="Cancellation Rate"
              value={`${summary.cancellationRate}%`}
              subtitle={`${summary.cancelledStays} cancelled, ${summary.noShowCount} no-show`}
              icon={XCircle}
              gradient="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
              iconBg="bg-rose-200 dark:bg-rose-800"
              iconColor="text-rose-700 dark:text-rose-400"
            />
            <SummaryCard
              title="Outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              subtitle={`${summary.collectionRate}% collected`}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
              iconBg="bg-orange-200 dark:bg-orange-800"
              iconColor="text-orange-700 dark:text-orange-400"
            />
            <SummaryCard
              title="ADR"
              value={formatCurrency(summary.adr)}
              subtitle="Avg Daily Rate"
              icon={BarChart3}
              gradient="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900"
              iconBg="bg-teal-200 dark:bg-teal-800"
              iconColor="text-teal-700 dark:text-teal-400"
            />
            <SummaryCard
              title="RevPAR"
              value={formatCurrency(summary.revpar)}
              subtitle={summary.averageRating !== null ? `\u2605 ${summary.averageRating}` : 'No ratings'}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900"
              iconBg="bg-pink-200 dark:bg-pink-800"
              iconColor="text-pink-700 dark:text-pink-400"
            />
          </div>

          {/* Charts Section (3 columns on desktop) */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {/* Monthly Revenue Trend - Enhancement 9: clickable */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    Monthly Revenue Trend
                  </CardTitle>
                  <CardDescription>Click a data point to filter table</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.monthlyRevenue.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                      <LineChart data={charts.monthlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                        <XAxis dataKey="month" tickFormatter={formatMonthLabel} className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `${currency.symbol}${v / 1000}k`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line
                          type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2}
                          dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }}
                          onClick={(entry) => { if (entry?.month) applyDrilldownFilter('month', entry.month); }}
                          style={{ cursor: 'pointer' }}
                        />
                        <Line
                          type="monotone" dataKey="bookings" stroke="#f59e0b" strokeWidth={2}
                          dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Guest Distribution by Nationality - Enhancement 9: clickable */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    Guest Distribution by Nationality
                  </CardTitle>
                  <CardDescription>Click a segment to filter table</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.nationalityDistribution.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                      <PieChart>
                        <Pie
                          data={charts.nationalityDistribution.map((item, index) => ({
                            ...item, fill: chartColors[index % chartColors.length],
                          }))}
                          cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="guests" nameKey="country" paddingAngle={2}
                          onClick={(entry) => { if (entry?.country) applyDrilldownFilter('nationality', entry.country); }}
                          style={{ cursor: 'pointer' }}
                        >
                          {charts.nationalityDistribution.map((_, index) => (
                            <Cell key={`nat-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent nameKey="country" />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Booking Status Distribution - Enhancement 9: clickable */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                    Booking Status Distribution
                  </CardTitle>
                  <CardDescription>Click a bar to filter table</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.bookingStatusDistribution.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                      <BarChart data={charts.bookingStatusDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                        <XAxis dataKey="status" className="text-xs" tickLine={false} axisLine={false} tickFormatter={formatStatusLabel} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}
                          onClick={(entry) => { if (entry?.status) applyDrilldownFilter('status', entry.status); }}
                          style={{ cursor: 'pointer' }}
                        >
                          {charts.bookingStatusDistribution.map((_, index) => (
                            <Cell key={`status-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Revenue by Room Type - Enhancement 9: clickable */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.25 }}>
              <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                    Revenue by Room Type
                  </CardTitle>
                  <CardDescription>Click a bar to filter table</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.revenueByRoomType.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                      <BarChart data={charts.revenueByRoomType} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={false} />
                        <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `${currency.symbol}${v / 1000}k`} />
                        <YAxis dataKey="roomType" type="category" className="text-xs" tickLine={false} axisLine={false} width={100} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={28}
                          onClick={(entry) => { if (entry?.roomType) applyDrilldownFilter('roomType', entry.roomType); }}
                          style={{ cursor: 'pointer' }}
                        >
                          {charts.revenueByRoomType.map((_, index) => (
                            <Cell key={`room-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Revenue by Booking Source */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
              <Card className="border-0 shadow-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue by Source</CardTitle>
                  <CardDescription>Booking channel performance</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.revenueBySource && charts.revenueBySource.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={charts.revenueBySource} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                        <XAxis type="number" tickFormatter={(v) => `${currency.symbol}${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="source" width={80} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} name="Revenue" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Enhancement 1: Payment Methods Chart */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }}>
              <Card className="border-0 shadow-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>Total amount by payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentSummaryData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={paymentSummaryData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `${currency.symbol}${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="method" width={110} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]} name="Amount">
                          {paymentSummaryData.map((_, index) => (
                            <Cell key={`pm-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No payment data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Cancellation Analysis */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.25 }}>
              <Card className="border-0 shadow-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cancellation Analysis</CardTitle>
                  <CardDescription>Booking outcome distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.cancellationAnalysis ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={[
                            { name: 'Checked Out', value: charts.cancellationAnalysis.checkedOut, fill: '#10b981' },
                            { name: 'Confirmed', value: charts.cancellationAnalysis.confirmed, fill: '#06b6d4' },
                            { name: 'Checked In', value: charts.cancellationAnalysis.checkedIn, fill: '#f59e0b' },
                            { name: 'Cancelled', value: charts.cancellationAnalysis.cancelled, fill: '#f43f5e' },
                            { name: 'No Show', value: charts.cancellationAnalysis.noShow, fill: '#94a3b8' },
                          ]}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Guest Retention */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }}>
              <Card className="border-0 shadow-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Guest Retention</CardTitle>
                  <CardDescription>First-time vs repeat guests</CardDescription>
                </CardHeader>
                <CardContent>
                  {charts.repeatGuestAnalysis ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={[
                            { name: 'First-Time', value: charts.repeatGuestAnalysis.firstTime.guests, fill: '#06b6d4' },
                            { name: 'Repeat', value: charts.repeatGuestAnalysis.repeat.guests, fill: '#8b5cf6' },
                          ]}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 2: Data Table */}
        {/* ============================================================== */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }}>
            <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Stay Records</CardTitle>
                    <CardDescription>
                      {sortedRecords.length} record{sortedRecords.length !== 1 ? 's' : ''} found
                      {drilldownFilter && <span className="ml-1 text-emerald-600 dark:text-emerald-400">(filtered)</span>}
                      {selectedRows.size > 0 && (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                          ({selectedRows.size} selected)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={val => { setPageSize(Number(val)); setCurrentPage(1); }}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <SelectItem key={size} value={String(size)}>{size} rows</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-10 px-2">
                          <input
                            type="checkbox"
                            className="rounded border-input h-3.5 w-3.5 accent-emerald-600"
                            checked={paginatedRecords.length > 0 && selectedRows.size === paginatedRecords.length}
                            onChange={toggleAllRows}
                            aria-label="Select all rows"
                          />
                        </TableHead>
                        {visibleColumns.map(key => (
                          <SortableHeader key={key} field={key as SortField} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                            {ALL_COLUMNS.find(c => c.key === key)?.label || key}
                          </SortableHeader>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns.length + 1} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Users className="h-8 w-8" />
                              <p className="font-medium">No records found</p>
                              <p className="text-xs">Try adjusting your filters or date range</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRecords.map(record => (
                          <TableRow
                            key={record.id}
                            className={cn(
                              'cursor-pointer transition-colors',
                              selectedRows.has(record.id) && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                            )}
                            onClick={() => handleRowClick(record)}
                          >
                            <TableCell className="w-10 px-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-input h-3.5 w-3.5 accent-emerald-600"
                                checked={selectedRows.has(record.id)}
                                onChange={() => toggleRow(record.id)}
                                aria-label={`Select ${record.guestName}`}
                              />
                            </TableCell>
                            {visibleColumns.map(key => (
                              <TableCell key={key} onClick={e => { if (key !== 'guestName') e.stopPropagation(); }}>
                                {renderCellContent(record, key)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {sortedRecords.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1}&ndash;{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                        &laquo;
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-2 min-w-[80px] text-center">
                        Page {currentPage} / {totalPages}
                      </span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                        &raquo;
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 3: Comparison (Enhancement 2) */}
        {/* ============================================================== */}
        <TabsContent value="comparison" className="space-y-6 mt-4">
          {!filters.enableComparison || !compareData ? (
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <ArrowUpDown className="h-10 w-10" />
                  <p className="font-medium">No Comparison Active</p>
                  <p className="text-sm text-center max-w-md">
                    Enable &ldquo;Compare Periods&rdquo; in the filter bar above and select a comparison date range to see period-over-period analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  Current: {format(appliedFilters.startDate, 'MMM dd, yyyy')} &ndash; {format(appliedFilters.endDate, 'MMM dd, yyyy')}
                </Badge>
                <span className="text-muted-foreground">vs</span>
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                  Previous: {format(appliedFilters.compareStartDate!, 'MMM dd, yyyy')} &ndash; {format(appliedFilters.compareEndDate!, 'MMM dd, yyyy')}
                </Badge>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <ComparisonMetricCard label="Total Guests" current={summary.totalGuests} previous={compareData.summary.totalGuests} />
                <ComparisonMetricCard label="Total Stays" current={summary.totalStays} previous={compareData.summary.totalStays} />
                <ComparisonMetricCard label="Total Room Nights" current={summary.totalRoomNights} previous={compareData.summary.totalRoomNights} />
                <ComparisonMetricCard label="Total Revenue" current={summary.totalRevenue} previous={compareData.summary.totalRevenue} formatFn={v => formatCurrencyValue(v, currency.symbol)} />
                <ComparisonMetricCard label="Avg Stay Length" current={summary.avgStayLength} previous={compareData.summary.avgStayLength} formatFn={v => `${v.toFixed(1)} nights`} />
                <ComparisonMetricCard label="Avg Revenue/Stay" current={summary.avgRevenuePerStay} previous={compareData.summary.avgRevenuePerStay} formatFn={v => formatCurrencyValue(v, currency.symbol)} />
                <ComparisonMetricCard label="Cancellation Rate" current={summary.cancellationRate} previous={compareData.summary.cancellationRate} formatFn={v => `${v.toFixed(1)}%`} />
                <ComparisonMetricCard label="ADR" current={summary.adr} previous={compareData.summary.adr} formatFn={v => formatCurrencyValue(v, currency.symbol)} />
                <ComparisonMetricCard label="RevPAR" current={summary.revpar} previous={compareData.summary.revpar} formatFn={v => formatCurrencyValue(v, currency.symbol)} />
                <ComparisonMetricCard label="Collection Rate" current={summary.collectionRate} previous={compareData.summary.collectionRate} formatFn={v => `${v.toFixed(1)}%`} />
                <ComparisonMetricCard label="Repeat Guests" current={summary.repeatGuestCount} previous={compareData.summary.repeatGuestCount} />
                <ComparisonMetricCard label="First-Time Guests" current={summary.firstTimeGuestCount} previous={compareData.summary.firstTimeGuestCount} />
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 4: Analytics (Enhancements 3, 4, 6) */}
        {/* ============================================================== */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {/* Enhancement 3: Cancellation Analysis */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-500" />
              Cancellation Analysis
            </h3>
            {extCancellation ? (
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard title="Cancellation Rate" value={`${extCancellation.cancellationRate.toFixed(1)}%`} icon={XCircle}
                    gradient="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900" iconBg="bg-rose-200 dark:bg-rose-800" iconColor="text-rose-700 dark:text-rose-400" />
                  <SummaryCard title="Cancelled Bookings" value={String(summary.cancelledStays)} icon={XCircle}
                    gradient="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900" iconBg="bg-red-200 dark:bg-red-800" iconColor="text-red-700 dark:text-red-400" />
                  <SummaryCard title="Cancelled Risk Score" value={extCancellation.avgRiskScore?.cancelled?.toFixed(1) || 'N/A'} icon={AlertTriangle}
                    gradient="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900" iconBg="bg-amber-200 dark:bg-amber-800" iconColor="text-amber-700 dark:text-amber-400" />
                  <SummaryCard title="Non-Cancelled Risk" value={extCancellation.avgRiskScore?.nonCancelled?.toFixed(1) || 'N/A'} icon={Shield}
                    gradient="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900" iconBg="bg-emerald-200 dark:bg-emerald-800" iconColor="text-emerald-700 dark:text-emerald-400" />
                </div>
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                  {/* Cancellation by Reason */}
                  {extCancellation.byReason && extCancellation.byReason.length > 0 && (
                    <Card className="border-0 shadow-sm rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Reason</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart data={extCancellation.byReason} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="reason" width={100} tick={{ fontSize: 11 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#f43f5e" name="Count" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                  {/* Cancellation by Lead Time Bucket */}
                  {extCancellation.byLeadTimeBucket && extCancellation.byLeadTimeBucket.length > 0 && (
                    <Card className="border-0 shadow-sm rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Lead Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart data={extCancellation.byLeadTimeBucket}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="rate" radius={[4, 4, 0, 0]} fill="#f59e0b" name="Cancellation Rate (%)" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                  {/* Monthly Cancellation Trend */}
                  {extCancellation.monthlyTrend && extCancellation.monthlyTrend.length > 0 && (
                    <Card className="border-0 shadow-sm rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Monthly Trend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <LineChart data={extCancellation.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                            <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 10 }} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} name="Rate (%)" />
                          </LineChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
                {/* Risk Score Comparison */}
                {extCancellation.avgRiskScore && (
                  <Card className="border-0 shadow-sm rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Risk Score Comparison
                      </CardTitle>
                      <CardDescription>Average risk score: cancelled vs non-cancelled bookings</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[180px] w-full max-w-md mx-auto">
                        <BarChart data={[
                          { name: 'Cancelled', score: extCancellation.avgRiskScore.cancelled, fill: '#f43f5e' },
                          { name: 'Non-Cancelled', score: extCancellation.avgRiskScore.nonCancelled, fill: '#10b981' },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-sm rounded-xl">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <XCircle className="h-8 w-8" />
                    <p className="font-medium">Extended cancellation data not available</p>
                    <p className="text-xs">The API does not return detailed cancellation analysis</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Enhancement 4: Revenue Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-500" />
              Revenue Breakdown
            </h3>
            {revBreakdown ? (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {/* Pie/Donut chart by category */}
                {revBreakdown.byCategory && revBreakdown.byCategory.length > 0 && (
                  <Card className="border-0 shadow-sm rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Revenue by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Pie
                            data={revBreakdown.byCategory.map((item, i) => ({
                              ...item, fill: chartColors[i % chartColors.length],
                            }))}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="amount" nameKey="category" paddingAngle={2}
                          >
                            {revBreakdown.byCategory.map((_, i) => (
                              <Cell key={`rc-${i}`} fill={chartColors[i % chartColors.length]} />
                            ))}
                          </Pie>
                          <ChartLegend content={<ChartLegendContent nameKey="category" />} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
                {/* Stacked bar by category by month */}
                {revBreakdown.byCategoryByMonth && revBreakdown.byCategoryByMonth.length > 0 && (
                  <Card className="border-0 shadow-sm rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Revenue by Category &amp; Month</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <BarChart data={revBreakdown.byCategoryByMonth}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                          <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => `${currency.symbol}${(v/1000).toFixed(0)}k`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          {revBreakdown.byCategory.map((cat, i) => (
                            <Bar key={cat.category} dataKey={cat.category} stackId="a" fill={chartColors[i % chartColors.length]} />
                          ))}
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-0 shadow-sm rounded-xl">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-8 w-8" />
                    <p className="font-medium">Revenue breakdown data not available</p>
                    <p className="text-xs">The API does not return detailed revenue breakdown</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Enhancement 6: Lead Time Analysis */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock4 className="h-5 w-5 text-cyan-500" />
              Booking Lead Time Analysis
            </h3>
            {leadTime ? (
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard title="Avg Lead Time" value={`${leadTime.averageLeadTime.toFixed(1)} days`} icon={Clock}
                    gradient="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900" iconBg="bg-cyan-200 dark:bg-cyan-800" iconColor="text-cyan-700 dark:text-cyan-400" />
                  <SummaryCard title="Median Lead Time" value={`${leadTime.medianLeadTime.toFixed(1)} days`} icon={Clock4}
                    gradient="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900" iconBg="bg-teal-200 dark:bg-teal-800" iconColor="text-teal-700 dark:text-teal-400" />
                  <SummaryCard title="Same-Day Cancel Rate" value={`${(leadTime.cancellationCorrelation?.sameDayCancellationRate ?? 0).toFixed(1)}%`} icon={AlertTriangle}
                    gradient="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900" iconBg="bg-amber-200 dark:bg-amber-800" iconColor="text-amber-700 dark:text-amber-400" />
                  <SummaryCard title="Advance Cancel Rate" value={`${(leadTime.cancellationCorrelation?.advanceCancellationRate ?? 0).toFixed(1)}%`} icon={Shield}
                    gradient="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900" iconBg="bg-emerald-200 dark:bg-emerald-800" iconColor="text-emerald-700 dark:text-emerald-400" />
                </div>
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                  {/* Distribution */}
                  {leadTime.distribution && leadTime.distribution.length > 0 && (
                    <Card className="border-0 shadow-sm rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Lead Time Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart data={leadTime.distribution}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#06b6d4" name="Bookings" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                  {/* By Source */}
                  {leadTime.bySource && leadTime.bySource.length > 0 && (
                    <Card className="border-0 shadow-sm rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Lead Time by Source</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart data={leadTime.bySource} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="source" width={90} tick={{ fontSize: 11 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="avgLeadTime" radius={[0, 4, 4, 0]} fill="#8b5cf6" name="Avg Lead Time (days)" />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <Card className="border-0 shadow-sm rounded-xl">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Clock4 className="h-8 w-8" />
                    <p className="font-medium">Lead time analysis data not available</p>
                    <p className="text-xs">The API does not return lead time analysis</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 5: Guest Value (Enhancement 5) */}
        {/* ============================================================== */}
        <TabsContent value="guests" className="space-y-6 mt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Top Guests by Lifetime Value
          </h3>
          {guestLTV && guestLTV.length > 0 ? (
            <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Guest Name</TableHead>
                        <TableHead className="text-xs text-right">Total Spent</TableHead>
                        <TableHead className="text-xs text-right">Total Stays</TableHead>
                        <TableHead className="text-xs text-right">Total Nights</TableHead>
                        <TableHead className="text-xs text-right">Avg per Stay</TableHead>
                        <TableHead className="text-xs">First Stay</TableHead>
                        <TableHead className="text-xs">Last Stay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guestLTV.slice(0, 10).map((g, idx) => (
                        <TableRow key={g.guestId} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                                {g.guestName.charAt(0)}
                              </div>
                              <span className="font-medium text-sm">{g.guestName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium text-right">{formatCurrencyValue(g.totalSpent, currency.symbol)}</TableCell>
                          <TableCell className="text-sm text-right">{g.totalStays}</TableCell>
                          <TableCell className="text-sm text-right">{g.totalNights}</TableCell>
                          <TableCell className="text-sm text-right">{formatCurrencyValue(g.avgPerStay, currency.symbol)}</TableCell>
                          <TableCell className="text-sm">{formatDateSafe(g.firstStay)}</TableCell>
                          <TableCell className="text-sm">{formatDateSafe(g.lastStay)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Users className="h-8 w-8" />
                  <p className="font-medium">Guest lifetime value data not available</p>
                  <p className="text-xs">The API does not return guest lifetime value data</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 6: Schedules (Enhancement 7) */}
        {/* ============================================================== */}
        <TabsContent value="schedules" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-emerald-500" />
              Scheduled Reports
            </h3>
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setScheduleOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              New Schedule
            </Button>
          </div>
          {scheduledReports.length > 0 ? (
            <div className="grid gap-3">
              {scheduledReports.map(sr => (
                <Card key={sr.id} className="border-0 shadow-sm rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{sr.name}</p>
                          <Badge variant="secondary" className={cn('text-xs',
                            sr.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400'
                          )}>
                            {sr.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{sr.frequency}</Badge>
                          <Badge variant="outline" className="text-xs">{sr.format.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {sr.time} {sr.timezone} &bull; {sr.recipients.length} recipient{sr.recipients.length !== 1 ? 's' : ''}
                          {sr.lastRun && ` \u2022 Last run: ${formatDateSafe(sr.lastRun)}`}
                          {sr.nextRun && ` \u2022 Next run: ${formatDateSafe(sr.nextRun)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={sr.active}
                          onCheckedChange={async (checked) => {
                            try {
                              const resp = await fetch(`/api/reports/scheduled/${sr.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ active: checked }),
                              });
                              if (resp.ok) {
                                setScheduledReports(prev => prev.map(s => s.id === sr.id ? { ...s, active: checked } : s));
                                toast.success(`Schedule ${checked ? 'activated' : 'deactivated'}`);
                              }
                            } catch { toast.error('Failed to update schedule'); }
                          }}
                        />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={async () => {
                            try {
                              const resp = await fetch(`/api/reports/scheduled/${sr.id}`, { method: 'DELETE' });
                              if (resp.ok) {
                                setScheduledReports(prev => prev.filter(s => s.id !== sr.id));
                                toast.success('Schedule deleted');
                              }
                            } catch { toast.error('Failed to delete schedule'); }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-sm rounded-xl">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-8 w-8" />
                  <p className="font-medium">No scheduled reports</p>
                  <p className="text-xs">Create a schedule to automate report delivery</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/* Detail Dialog */}
      {/* ================================================================== */}
      <GuestDetailDialog
        record={detailRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        currencySymbol={currency.symbol}
      />

      {/* ================================================================== */}
      {/* Enhancement 7: Schedule Report Dialog */}
      {/* ================================================================== */}
      <ScheduleReportDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSaved={fetchScheduledReports}
      />

      {/* ================================================================== */}
      {/* Enhancement 7: View Schedules Dialog */}
      {/* ================================================================== */}
      <Dialog open={viewSchedulesOpen} onOpenChange={setViewSchedulesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-emerald-500" />
              Scheduled Reports
            </DialogTitle>
            <DialogDescription>Manage your automated report schedules</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {scheduledReports.length > 0 ? (
              <div className="space-y-3 pr-4">
                {scheduledReports.map(sr => (
                  <Card key={sr.id} className="bg-muted/30 border-0">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{sr.name}</p>
                            <Badge variant="secondary" className={cn('text-xs', sr.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700')}>
                              {sr.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {sr.frequency} at {sr.time} {sr.timezone} &bull; {sr.format.toUpperCase()} &bull; {sr.recipients.join(', ')}
                          </p>
                          {sr.nextRun && <p className="text-xs text-muted-foreground">Next: {formatDateSafe(sr.nextRun)}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={sr.active}
                            onCheckedChange={async (checked) => {
                              try {
                                const resp = await fetch(`/api/reports/scheduled/${sr.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ active: checked }),
                                });
                                if (resp.ok) {
                                  setScheduledReports(prev => prev.map(s => s.id === sr.id ? { ...s, active: checked } : s));
                                  toast.success(`Schedule ${checked ? 'activated' : 'deactivated'}`);
                                }
                              } catch { toast.error('Failed to update'); }
                            }}
                          />
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={async () => {
                            try {
                              const resp = await fetch(`/api/reports/scheduled/${sr.id}`, { method: 'DELETE' });
                              if (resp.ok) {
                                setScheduledReports(prev => prev.filter(s => s.id !== sr.id));
                                toast.success('Deleted');
                              }
                            } catch { toast.error('Failed to delete'); }
                          }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <CalendarClock className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">No scheduled reports yet</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
