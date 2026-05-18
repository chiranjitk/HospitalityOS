'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
}

type SortField = keyof GuestStayRecord;
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Constants
// ============================================================================

const chartConfig = {
  revenue: { label: 'Revenue', color: '#10b981' },
  bookings: { label: 'Bookings', color: '#f59e0b' },
  guests: { label: 'Guests', color: '#8b5cf6' },
  count: { label: 'Count', color: '#06b6d4' },
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
  if (!tier) return <span className="text-muted-foreground text-xs">—</span>;
  const TierIcon = tierIcons[tier];
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium gap-1', tierBadgeVariants[tier])}>
      {TierIcon && <TierIcon className="h-3 w-3" />}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function VIPBadge({ isVIP }: { isVIP: boolean }) {
  if (!isVIP) return <span className="text-muted-foreground text-xs">—</span>;
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
                      {record.roomNumber} — {record.roomType}
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
      const response = await fetch(`/api/reports/guest-stay-report?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load report data');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
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
      // Silently fail — property dropdown will show "All Properties"
    }
  }, []);

  useEffect(() => {
    fetchData(appliedFilters);
  }, [appliedFilters, fetchData]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ---- Filter Handlers ----
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
    setSelectedRows(new Set());
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

  const sortedRecords = useMemo(() => {
    if (!data?.records) return [];
    const sorted = [...data.records].sort((a, b) => {
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
  }, [data, sortField, sortDirection]);

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

      if (format === 'pdf') {
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') || '';
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        const downloadFilename = filenameMatch?.[1]?.replace(/['"]/g, '') || 'guest-stay-report.pdf';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('PDF exported successfully');
      } else {
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') || '';
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        const downloadFilename = filenameMatch?.[1]?.replace(/['"]/g, '') || `guest-stay-report.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()} successfully`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  }, [appliedFilters]);

  // ---- Sortable Column Header ----
  // (SortableHeader is defined outside this component)

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
        </div>

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
      {/* Summary Cards Row */}
      {/* ================================================================== */}
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

      {/* ================================================================== */}
      {/* Charts Section (3 columns on desktop) */}
      {/* ================================================================== */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Monthly Revenue Trend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                Monthly Revenue Trend
              </CardTitle>
              <CardDescription>Revenue and bookings over time</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.monthlyRevenue.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <LineChart data={charts.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonthLabel}
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${currency.symbol}${v / 1000}k`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#10b981' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="bookings"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#f59e0b' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Guest Distribution by Nationality */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                Guest Distribution by Nationality
              </CardTitle>
              <CardDescription>Top countries by guest count</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.nationalityDistribution.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <PieChart>
                    <Pie
                      data={charts.nationalityDistribution.map((item, index) => ({
                        ...item,
                        fill: chartColors[index % chartColors.length],
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="guests"
                      nameKey="country"
                      paddingAngle={2}
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

        {/* Booking Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                Booking Status Distribution
              </CardTitle>
              <CardDescription>Bookings by current status</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.bookingStatusDistribution.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <BarChart data={charts.bookingStatusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis
                      dataKey="status"
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatStatusLabel}
                    />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
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

        {/* Revenue by Room Type */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
        >
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                Revenue by Room Type
              </CardTitle>
              <CardDescription>Revenue breakdown by accommodation</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.revenueByRoomType.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
                  <BarChart data={charts.revenueByRoomType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={false} />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${currency.symbol}${v / 1000}k`}
                    />
                    <YAxis
                      dataKey="roomType"
                      type="category"
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={28}>
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
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

        {/* Cancellation Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
        >
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
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
        >
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
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
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

      {/* ================================================================== */}
      {/* Data Table */}
      {/* ================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Stay Records</CardTitle>
                <CardDescription>
                  {sortedRecords.length} record{sortedRecords.length !== 1 ? 's' : ''} found
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
                  onValueChange={val => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
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
                    <SortableHeader field="guestName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Guest</SortableHeader>
                    <SortableHeader field="nationality" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nationality</SortableHeader>
                    <TableHead>VIP</TableHead>
                    <TableHead>Tier</TableHead>
                    <SortableHeader field="confirmationCode" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Conf. Code</SortableHeader>
                    <SortableHeader field="propertyName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Property</SortableHeader>
                    <SortableHeader field="roomNumber" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Room</SortableHeader>
                    <SortableHeader field="roomType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Room Type</SortableHeader>
                    <SortableHeader field="checkIn" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Check-In</SortableHeader>
                    <SortableHeader field="checkOut" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Check-Out</SortableHeader>
                    <SortableHeader field="nights" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Nights</SortableHeader>
                    <SortableHeader field="totalAmount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Total</SortableHeader>
                    <SortableHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortableHeader>
                    <SortableHeader field="paymentStatus" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Payment</SortableHeader>
                    <SortableHeader field="source" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Source</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center py-12">
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
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{record.guestName}</p>
                            <p className="text-xs text-muted-foreground">{record.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{record.nationality}</TableCell>
                        <TableCell><VIPBadge isVIP={record.isVIP} /></TableCell>
                        <TableCell><LoyaltyTierBadge tier={record.loyaltyTier} /></TableCell>
                        <TableCell><span className="font-mono text-xs">{record.confirmationCode}</span></TableCell>
                        <TableCell className="text-sm">{record.propertyName}</TableCell>
                        <TableCell className="text-sm font-medium">{record.roomNumber}</TableCell>
                        <TableCell className="text-sm">{record.roomType}</TableCell>
                        <TableCell className="text-sm">{formatDateSafe(record.checkIn)}</TableCell>
                        <TableCell className="text-sm">{formatDateSafe(record.checkOut)}</TableCell>
                        <TableCell className="text-sm text-center">{record.nights}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrencyValue(record.totalAmount, currency.symbol)}</TableCell>
                        <TableCell><StatusBadge status={record.status} /></TableCell>
                        <TableCell><PaymentStatusBadge status={record.paymentStatus} /></TableCell>
                        <TableCell className="text-sm">{formatStatusLabel(record.source)}</TableCell>
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
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2 min-w-[80px] text-center">
                    Page {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================== */}
      {/* Detail Dialog */}
      {/* ================================================================== */}
      <GuestDetailDialog
        record={detailRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        currencySymbol={currency.symbol}
      />
    </div>
  );
}
