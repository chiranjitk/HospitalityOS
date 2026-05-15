'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  RefreshCw,
  Settings,
  Check,
  X,
  Clock,
  Link2,
  Zap,
  Database,
  Wifi,
  Save,
  Edit,
  Plus,
  Trash2,
  AlertTriangle,
  Plug,
  Activity,
  DollarSign,
  ChevronRight,
  Copy,
  Filter,
  ArrowUpDown,
  MoreVertical,
  TestTube,
  Upload,
  Download,
  BarChart3,
  Tag,
  Layers,
  ShieldCheck,
  Cable,
  Play,
  Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from 'next-intl';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GDSConnection {
  id: string;
  name: string;
  code: string;
  provider: 'Amadeus' | 'Sabre' | 'Travelport';
  status: 'active' | 'inactive' | 'error' | 'pending';
  lastSync: Date | null;
  lastSyncStatus: 'success' | 'failed' | 'partial';
  hotelCode: string;
  chainCode: string;
  pcc: string; // Pseudo City Code
  rateAccessCode: string;
  features: {
    inventory: boolean;
    rates: boolean;
    bookings: boolean;
    restrictions: boolean;
    updates: boolean;
  };
  syncInterval: number;
  autoSync: boolean;
  bookingsRetrieved: number;
  commissionRate: number;
  revenue: number;
}

interface RateDistribution {
  id: string;
  rateCode: string;
  rateName: string;
  gdsProvider: string;
  gdsRateCode: string;
  rateType: 'BAR' | 'RACK' | 'Corporate' | 'Negotiated' | 'Wholesale' | 'Seasonal' | 'Promotional';
  roomTypes: string[];
  singleRate: number;
  doubleRate: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: 'active' | 'inactive' | 'draft';
  lastDistributed: Date | null;
  roomsAvailable: number;
}

interface GDSBooking {
  id: string;
  pnr: string;
  guestName: string;
  gdsSource: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  rateCode: string;
  totalAmount: number;
  currency: string;
  status: 'confirmed' | 'modified' | 'cancelled' | 'no-show' | 'checked-in' | 'checked-out';
  segments: number;
  retrievedAt: string;
}

interface GDSRateCode {
  id: string;
  code: string;
  name: string;
  category: 'corporate' | 'negotiated' | 'wholesale' | 'consortia' | 'government' | 'promo' | 'package';
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed' | 'net';
  minStay: number;
  maxStay: number;
  commission: number;
  mealPlan: string;
  status: 'active' | 'inactive' | 'expired';
  validFrom: string;
  validTo: string;
  bookingCount: number;
  revenueGenerated: number;
}

interface GDSStats {
  activeConnections: number;
  totalBookings: number;
  totalRevenue: number;
  lastSyncTime: Date | null;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const connections: GDSConnection[] = [
  {
    id: 'gds-1',
    name: 'Amadeus GDS',
    code: 'AMA',
    provider: 'Amadeus',
    status: 'active',
    lastSync: new Date(Date.now() - 12 * 60 * 1000),
    lastSyncStatus: 'success',
    hotelCode: 'DELRSI',
    chainCode: 'RS',
    pcc: 'DEL9A',
    rateAccessCode: 'RSI2024',
    features: { inventory: true, rates: true, bookings: true, restrictions: true, updates: true },
    syncInterval: 15,
    autoSync: true,
    bookingsRetrieved: 1247,
    commissionRate: 10,
    revenue: 1845000,
  },
  {
    id: 'gds-2',
    name: 'Sabre GDS',
    code: 'SAB',
    provider: 'Sabre',
    status: 'active',
    lastSync: new Date(Date.now() - 45 * 60 * 1000),
    lastSyncStatus: 'success',
    hotelCode: 'DELRSI',
    chainCode: 'RS',
    pcc: 'DEL7B',
    rateAccessCode: 'RSISAB',
    features: { inventory: true, rates: true, bookings: true, restrictions: true, updates: false },
    syncInterval: 30,
    autoSync: true,
    bookingsRetrieved: 983,
    commissionRate: 10,
    revenue: 1423000,
  },
  {
    id: 'gds-3',
    name: 'Travelport GDS',
    code: 'TVL',
    provider: 'Travelport',
    status: 'error',
    lastSync: new Date(Date.now() - 6 * 60 * 60 * 1000),
    lastSyncStatus: 'failed',
    hotelCode: 'DELRSI',
    chainCode: 'RS',
    pcc: 'DEL4C',
    rateAccessCode: 'RSITVL',
    features: { inventory: true, rates: true, bookings: true, restrictions: false, updates: false },
    syncInterval: 30,
    autoSync: false,
    bookingsRetrieved: 412,
    commissionRate: 11,
    revenue: 587000,
  },
];

const rateDistributions: RateDistribution[] = [
  { id: 'rd-1', rateCode: 'BAR', rateName: 'Best Available Rate', gdsProvider: 'Amadeus', gdsRateCode: 'BAR01', rateType: 'BAR', roomTypes: ['Deluxe King', 'Premium Suite', 'Standard Room'], singleRate: 8500, doubleRate: 10500, currency: 'INR', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'active', lastDistributed: new Date(Date.now() - 15 * 60 * 1000), roomsAvailable: 42 },
  { id: 'rd-2', rateCode: 'RACK', rateName: 'Rack Rate', gdsProvider: 'Amadeus', gdsRateCode: 'RACK01', rateType: 'RACK', roomTypes: ['All Room Types'], singleRate: 12000, doubleRate: 15000, currency: 'INR', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'active', lastDistributed: new Date(Date.now() - 15 * 60 * 1000), roomsAvailable: 56 },
  { id: 'rd-3', rateCode: 'CORP01', rateName: 'Corporate Rate - Standard', gdsProvider: 'Sabre', gdsRateCode: 'CRPSTD', rateType: 'Corporate', roomTypes: ['Deluxe King', 'Executive Suite'], singleRate: 7200, doubleRate: 8900, currency: 'INR', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'active', lastDistributed: new Date(Date.now() - 2 * 60 * 60 * 1000), roomsAvailable: 18 },
  { id: 'rd-4', rateCode: 'CORP02', rateName: 'Corporate Rate - Premium', gdsProvider: 'Sabre', gdsRateCode: 'CRPPRM', rateType: 'Corporate', roomTypes: ['Premium Suite', 'Royal Suite'], singleRate: 9800, doubleRate: 12500, currency: 'INR', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'active', lastDistributed: new Date(Date.now() - 2 * 60 * 60 * 1000), roomsAvailable: 8 },
  { id: 'rd-5', rateCode: 'NEGO01', rateName: 'Negotiated - TATA Group', gdsProvider: 'Amadeus', gdsRateCode: 'NGOTTA', rateType: 'Negotiated', roomTypes: ['Deluxe King', 'Standard Room'], singleRate: 6500, doubleRate: 8000, currency: 'INR', effectiveFrom: '2025-04-01', effectiveTo: '2026-03-31', status: 'active', lastDistributed: new Date(Date.now() - 24 * 60 * 60 * 1000), roomsAvailable: 25 },
  { id: 'rd-6', rateCode: 'WHSL01', rateName: 'Wholesale - MakeMyTrip', gdsProvider: 'Travelport', gdsRateCode: 'WSLMMT', rateType: 'Wholesale', roomTypes: ['Standard Room', 'Deluxe King'], singleRate: 5800, doubleRate: 7200, currency: 'INR', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'active', lastDistributed: new Date(Date.now() - 6 * 60 * 60 * 1000), roomsAvailable: 30 },
  { id: 'rd-7', rateCode: 'SEAS01', rateName: 'Peak Season Rate', gdsProvider: 'Amadeus', gdsRateCode: 'SEAPK', rateType: 'Seasonal', roomTypes: ['All Room Types'], singleRate: 15000, doubleRate: 18500, currency: 'INR', effectiveFrom: '2025-10-01', effectiveTo: '2026-03-31', status: 'active', lastDistributed: new Date(Date.now() - 30 * 60 * 1000), roomsAvailable: 56 },
  { id: 'rd-8', rateCode: 'SEAS02', rateName: 'Off-Season Rate', gdsProvider: 'Amadeus', gdsRateCode: 'SEAOF', rateType: 'Seasonal', roomTypes: ['All Room Types'], singleRate: 6500, doubleRate: 8000, currency: 'INR', effectiveFrom: '2025-04-01', effectiveTo: '2025-09-30', status: 'inactive', lastDistributed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), roomsAvailable: 56 },
  { id: 'rd-9', rateCode: 'PROM01', rateName: 'Monsoon Special', gdsProvider: 'Sabre', gdsRateCode: 'PRMMNS', rateType: 'Promotional', roomTypes: ['Standard Room', 'Deluxe King'], singleRate: 5500, doubleRate: 6800, currency: 'INR', effectiveFrom: '2025-06-01', effectiveTo: '2025-09-15', status: 'draft', lastDistributed: null, roomsAvailable: 0 },
];

const bookings: GDSBooking[] = [
  { id: 'gb-1', pnr: 'AMA-X9K2L4', guestName: 'James Richardson', gdsSource: 'Amadeus', roomType: 'Deluxe King', checkIn: '2025-06-15', checkOut: '2025-06-18', rateCode: 'BAR', totalAmount: 31500, currency: 'INR', status: 'confirmed', segments: 1, retrievedAt: '2025-06-10T14:30:00Z' },
  { id: 'gb-2', pnr: 'SAB-M3P7Q9', guestName: 'Sarah Mitchell', gdsSource: 'Sabre', roomType: 'Premium Suite', checkIn: '2025-06-16', checkOut: '2025-06-20', rateCode: 'CORP02', totalAmount: 50000, currency: 'INR', status: 'confirmed', segments: 1, retrievedAt: '2025-06-11T09:15:00Z' },
  { id: 'gb-3', pnr: 'AMA-H5R8T1', guestName: 'Akira Tanaka', gdsSource: 'Amadeus', roomType: 'Executive Suite', checkIn: '2025-06-14', checkOut: '2025-06-17', rateCode: 'NEGO01', totalAmount: 24000, currency: 'INR', status: 'modified', segments: 2, retrievedAt: '2025-06-09T18:45:00Z' },
  { id: 'gb-4', pnr: 'TVL-J7N2V3', guestName: 'Elena Petrov', gdsSource: 'Travelport', roomType: 'Standard Room', checkIn: '2025-06-12', checkOut: '2025-06-14', rateCode: 'WHSL01', totalAmount: 14400, currency: 'INR', status: 'checked-out', segments: 1, retrievedAt: '2025-06-08T11:20:00Z' },
  { id: 'gb-5', pnr: 'SAB-K9P4W5', guestName: 'Michael O\'Brien', gdsSource: 'Sabre', roomType: 'Royal Suite', checkIn: '2025-06-18', checkOut: '2025-06-22', rateCode: 'SEAS01', totalAmount: 74000, currency: 'INR', status: 'confirmed', segments: 1, retrievedAt: '2025-06-12T16:00:00Z' },
  { id: 'gb-6', pnr: 'AMA-L1Q6X7', guestName: 'Priya Sharma', gdsSource: 'Amadeus', roomType: 'Deluxe King', checkIn: '2025-06-10', checkOut: '2025-06-11', rateCode: 'BAR', totalAmount: 10500, currency: 'INR', status: 'checked-out', segments: 1, retrievedAt: '2025-06-07T08:30:00Z' },
  { id: 'gb-7', pnr: 'SAB-M3R8Y9', guestName: 'David Chen', gdsSource: 'Sabre', roomType: 'Premium Suite', checkIn: '2025-06-20', checkOut: '2025-06-23', rateCode: 'CORP01', totalAmount: 26700, currency: 'INR', status: 'confirmed', segments: 1, retrievedAt: '2025-06-13T10:45:00Z' },
  { id: 'gb-8', pnr: 'AMA-N5S0Z1', guestName: 'Laura Mueller', gdsSource: 'Amadeus', roomType: 'Standard Room', checkIn: '2025-06-13', checkOut: '2025-06-15', rateCode: 'BAR', totalAmount: 21000, currency: 'INR', status: 'cancelled', segments: 1, retrievedAt: '2025-06-10T13:15:00Z' },
  { id: 'gb-9', pnr: 'TVL-O7T2A3', guestName: 'Roberto Silva', gdsSource: 'Travelport', roomType: 'Deluxe King', checkIn: '2025-06-19', checkOut: '2025-06-21', rateCode: 'WHSL01', totalAmount: 14400, currency: 'INR', status: 'confirmed', segments: 1, retrievedAt: '2025-06-14T07:00:00Z' },
  { id: 'gb-10', pnr: 'SAB-P9U4B5', guestName: 'Anna Kowalski', gdsSource: 'Sabre', roomType: 'Executive Suite', checkIn: '2025-06-11', checkOut: '2025-06-13', rateCode: 'SEAS01', totalAmount: 37000, currency: 'INR', status: 'no-show', segments: 1, retrievedAt: '2025-06-06T22:30:00Z' },
];

const rateCodes: GDSRateCode[] = [
  { id: 'rc-1', code: 'CORPSTD', name: 'Corporate Standard', category: 'corporate', description: 'Standard corporate rate for business travelers', discount: 15, discountType: 'percentage', minStay: 1, maxStay: 30, commission: 10, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 456, revenueGenerated: 3200000 },
  { id: 'rc-2', code: 'CORPPRM', name: 'Corporate Premium', category: 'corporate', description: 'Premium corporate rate for executive bookings', discount: 10, discountType: 'percentage', minStay: 1, maxStay: 30, commission: 10, mealPlan: 'Half Board', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 312, revenueGenerated: 4800000 },
  { id: 'rc-3', code: 'NGOTATA', name: 'TATA Negotiated', category: 'negotiated', description: 'Special negotiated rate for TATA Group employees', discount: 25, discountType: 'percentage', minStay: 1, maxStay: 14, commission: 0, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-04-01', validTo: '2026-03-31', bookingCount: 189, revenueGenerated: 980000 },
  { id: 'rc-4', code: 'NGOWIPRO', name: 'Wipro Corporate', category: 'negotiated', description: 'Negotiated rate for Wipro Technologies', discount: 22, discountType: 'percentage', minStay: 3, maxStay: 30, commission: 0, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 234, revenueGenerated: 1450000 },
  { id: 'rc-5', code: 'WSLMMT', name: 'MMT Wholesale', category: 'wholesale', description: 'Wholesale rate for MakeMyTrip B2B channel', discount: 35, discountType: 'percentage', minStay: 1, maxStay: 7, commission: 18, mealPlan: 'Room Only', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 678, revenueGenerated: 2900000 },
  { id: 'rc-6', code: 'WSLGOIB', name: 'Goibibo Wholesale', category: 'wholesale', description: 'Wholesale allocation for Goibibo', discount: 30, discountType: 'percentage', minStay: 1, maxStay: 5, commission: 17, mealPlan: 'Room Only', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 445, revenueGenerated: 1800000 },
  { id: 'rc-7', code: 'CONIHCL', name: 'IHCL Consortia', category: 'consortia', description: 'Consortia rate for IHCL partner hotels', discount: 20, discountType: 'percentage', minStay: 2, maxStay: 14, commission: 12, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 156, revenueGenerated: 1200000 },
  { id: 'rc-8', code: 'CONGHA', name: 'GHA Discovery', category: 'consortia', description: 'Global Hotel Alliance Discovery loyalty rate', discount: 15, discountType: 'percentage', minStay: 1, maxStay: 21, commission: 10, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 289, revenueGenerated: 2100000 },
  { id: 'rc-9', code: 'GOVCPW', name: 'Government CPW', category: 'government', description: 'Central Pay Ward government rate', discount: 40, discountType: 'percentage', minStay: 1, maxStay: 30, commission: 0, mealPlan: 'Room Only', status: 'active', validFrom: '2025-01-01', validTo: '2025-12-31', bookingCount: 98, revenueGenerated: 450000 },
  { id: 'rc-10', code: 'PRMSUM', name: 'Summer Saver', category: 'promo', description: 'Promotional rate for summer travel season', discount: 20, discountType: 'percentage', minStay: 2, maxStay: 7, commission: 15, mealPlan: 'Bed & Breakfast', status: 'active', validFrom: '2025-04-01', validTo: '2025-06-30', bookingCount: 345, revenueGenerated: 1600000 },
];

const stats: GDSStats = {
  activeConnections: 2,
  totalBookings: 2642,
  totalRevenue: 3853000,
  lastSyncTime: new Date(Date.now() - 12 * 60 * 1000),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    error: { label: 'Error', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    modified: { label: 'Modified', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'no-show': { label: 'No-Show', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    'checked-in': { label: 'Checked In', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
    'checked-out': { label: 'Checked Out', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    expired: { label: 'Expired', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  };
  return map[status] || map.pending;
}

function getProviderIcon(provider: string) {
  switch (provider) {
    case 'Amadeus': return Database;
    case 'Sabre': return ShieldCheck;
    case 'Travelport': return Cable;
    default: return Globe;
  }
}

function getProviderColor(provider: string) {
  switch (provider) {
    case 'Amadeus': return 'from-red-500/10 to-red-600/5 border-red-500/20';
    case 'Sabre': return 'from-blue-500/10 to-blue-600/5 border-blue-500/20';
    case 'Travelport': return 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20';
    default: return 'from-gray-500/10 to-gray-600/5 border-gray-500/20';
  }
}

function getRateTypeColor(type: string) {
  const map: Record<string, string> = {
    BAR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    RACK: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    Corporate: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    Negotiated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Wholesale: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Seasonal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Promotional: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  };
  return map[type] || 'bg-gray-100 text-gray-700';
}

function getCategoryColor(category: string) {
  const map: Record<string, string> = {
    corporate: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    negotiated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    wholesale: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    consortia: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    government: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    promo: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    package: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return map[category] || 'bg-gray-100 text-gray-700';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GDSConnectivity() {
  const t = useTranslations('channels');
  const { formatCurrency } = useCurrency();

  // Data state
  const [connections, setConnections] = useState<GDSConnection[]>([]);
  const [rateDistributions, setRateDistributions] = useState<RateDistribution[]>([]);
  const [bookings, setBookings] = useState<GDSBooking[]>([]);
  const [rateCodes, setRateCodes] = useState<GDSRateCode[]>([]);
  const [stats, setStats] = useState<GDSStats>({ activeConnections: 0, totalBookings: 0, totalRevenue: 0, lastSyncTime: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [connectionDialog, setConnectionDialog] = useState<{ open: boolean; item: GDSConnection | null }>({ open: false, item: null });
  const [rateCodeDialog, setRateCodeDialog] = useState<{ open: boolean; item: GDSRateCode | null }>({ open: false, item: null });
  const [rateCodeForm, setRateCodeForm] = useState({
    code: '', name: '', category: 'corporate' as GDSRateCode['category'],
    description: '', discount: '', discountType: 'percentage' as GDSRateCode['discountType'],
    minStay: '1', maxStay: '30', commission: '10', mealPlan: 'Bed & Breakfast',
    validFrom: '', validTo: '',
  });

  // Filter state
  const [bookingFilter, setBookingFilter] = useState('all');
  const [rateCodeFilter, setRateCodeFilter] = useState('all');
  const [rateDistFilter, setRateDistFilter] = useState('all');

  // Fetch real data from API
  const fetchConnectionsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/connections');
      if (!res.ok) throw new Error('Failed to fetch channel connections');
      const json = await res.json();

      if (json.success && json.data) {
        const enrichedConns: GDSConnection[] = json.data.map((c: Record<string, unknown>) => {
          const ch = c.channelMeta as Record<string, unknown> | undefined;
          return {
            id: c.id as string,
            name: (c.displayName as string) || (c.channel as string),
            code: (ch?.id as string) || (c.channel as string)?.slice(0, 3).toUpperCase() || '',
            provider: (c.channel as string) === 'amadeus' ? 'Amadeus' as const : (c.channel as string) === 'sabre' ? 'Sabre' as const : 'Travelport' as const,
            status: (c.status as GDSConnection['status']) || 'pending',
            lastSync: c.lastSyncAt ? new Date(c.lastSyncAt as string) : null,
            lastSyncStatus: (c.lastSyncAt ? 'success' : 'pending') as GDSConnection['lastSyncStatus'],
            hotelCode: (c.hotelId as string) || '',
            chainCode: '',
            pcc: '',
            rateAccessCode: '',
            features: { inventory: true, rates: true, bookings: true, restrictions: false, updates: false },
            syncInterval: (c.syncInterval as number) || 60,
            autoSync: (c.autoSync as boolean) ?? true,
            bookingsRetrieved: (c.mappingCount as number) || 0,
            commissionRate: (ch?.commission as Record<string, unknown>)?.max ? Number((ch.commission as Record<string, unknown>).max) : 10,
            revenue: 0,
          };
        });
        setConnections(enrichedConns);

        const activeCount = enrichedConns.filter(c => c.status === 'active').length;
        const lastSync = enrichedConns.reduce((latest: Date | null, c) => {
          if (c.lastSync && (!latest || c.lastSync > latest)) return c.lastSync;
          return latest;
        }, null);

        setStats({
          activeConnections: activeCount,
          totalBookings: enrichedConns.reduce((s, c) => s + c.bookingsRetrieved, 0),
          totalRevenue: enrichedConns.reduce((s, c) => s + c.revenue, 0),
          lastSyncTime: lastSync,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnectionsData(); }, [fetchConnectionsData]);

  const fetchMockData = useCallback(() => { fetchConnectionsData(); }, [fetchConnectionsData]);

  // ─── Connection handlers ──────────────────────────────────────────────────

  const handleTestConnection = async (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (!conn) return;

    toast.info(`Testing ${conn.name} connection...`);
    try {
      const res = await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'test' }),
      });
      const json = await res.json();
      if (json.success) {
        setConnections(prev => prev.map(c =>
          c.id === id ? { ...c, status: 'active' as const, lastSync: new Date(), lastSyncStatus: 'success' as const } : c
        ));
        toast.success(`${conn.name} connection test successful`);
      } else {
        toast.error(`Connection test failed: ${json.message || json.error?.message || 'Unknown error'}`);
      }
    } catch {
      toast.error('Connection test failed: Network error');
    }
  };

  const handleToggleAutoSync = (id: string, autoSync: boolean) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, autoSync } : c
    ));
    toast.success(`Auto-sync ${autoSync ? 'enabled' : 'disabled'}`);
  };

  const handleSyncNow = async (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (!conn) return;

    toast.info(`Syncing with ${conn.name}...`);
    try {
      const res = await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'sync' }),
      });
      const json = await res.json();
      if (json.success) {
        setConnections(prev => prev.map(c =>
          c.id === id ? { ...c, lastSync: new Date(), lastSyncStatus: 'success' as const } : c
        ));
        toast.success(`${conn.name} sync completed`);
      } else {
        toast.error(`Sync failed: ${json.message || 'Unknown error'}`);
      }
    } catch {
      toast.error('Sync failed: Network error');
    }
  };

  const openConnectionConfig = (conn: GDSConnection) => {
    setConnectionDialog({ open: true, item: conn });
  };

  // ─── Rate Code CRUD ───────────────────────────────────────────────────────

  const openNewRateCode = () => {
    setRateCodeForm({
      code: '', name: '', category: 'corporate', description: '', discount: '',
      discountType: 'percentage', minStay: '1', maxStay: '30', commission: '10',
      mealPlan: 'Bed & Breakfast', validFrom: '', validTo: '',
    });
    setRateCodeDialog({ open: true, item: null });
  };

  const openEditRateCode = (rc: GDSRateCode) => {
    setRateCodeForm({
      code: rc.code, name: rc.name, category: rc.category, description: rc.description,
      discount: String(rc.discount), discountType: rc.discountType,
      minStay: String(rc.minStay), maxStay: String(rc.maxStay),
      commission: String(rc.commission), mealPlan: rc.mealPlan,
      validFrom: rc.validFrom, validTo: rc.validTo,
    });
    setRateCodeDialog({ open: true, item: rc });
  };

  const handleSaveRateCode = () => {
    if (!rateCodeForm.code.trim() || !rateCodeForm.name.trim()) {
      toast.error('Please fill in required fields (Code, Name)');
      return;
    }

    if (rateCodeDialog.item) {
      // Update
      setRateCodes(prev => prev.map(rc =>
        rc.id === rateCodeDialog.item!.id
          ? {
            ...rc,
            code: rateCodeForm.code, name: rateCodeForm.name, category: rateCodeForm.category,
            description: rateCodeForm.description, discount: parseFloat(rateCodeForm.discount) || 0,
            discountType: rateCodeForm.discountType, minStay: parseInt(rateCodeForm.minStay) || 1,
            maxStay: parseInt(rateCodeForm.maxStay) || 30, commission: parseFloat(rateCodeForm.commission) || 0,
            mealPlan: rateCodeForm.mealPlan, validFrom: rateCodeForm.validFrom, validTo: rateCodeForm.validTo,
          }
          : rc
      ));
      toast.success('Rate code updated');
    } else {
      // Create
      const newRc: GDSRateCode = {
        id: `rc-${Date.now()}`, code: rateCodeForm.code, name: rateCodeForm.name,
        category: rateCodeForm.category, description: rateCodeForm.description,
        discount: parseFloat(rateCodeForm.discount) || 0, discountType: rateCodeForm.discountType,
        minStay: parseInt(rateCodeForm.minStay) || 1, maxStay: parseInt(rateCodeForm.maxStay) || 30,
        commission: parseFloat(rateCodeForm.commission) || 0, mealPlan: rateCodeForm.mealPlan,
        status: 'active', validFrom: rateCodeForm.validFrom, validTo: rateCodeForm.validTo,
        bookingCount: 0, revenueGenerated: 0,
      };
      setRateCodes(prev => [...prev, newRc]);
      toast.success('Rate code created');
    }
    setRateCodeDialog({ open: false, item: null });
  };

  const handleDeleteRateCode = (id: string) => {
    setRateCodes(prev => prev.filter(rc => rc.id !== id));
    toast.success('Rate code deleted');
  };

  const handleToggleRateCodeStatus = (id: string) => {
    setRateCodes(prev => prev.map(rc =>
      rc.id === id ? { ...rc, status: rc.status === 'active' ? 'inactive' as const : 'active' as const } : rc
    ));
  };

  // ─── Filtered data ────────────────────────────────────────────────────────

  const filteredBookings = bookingFilter === 'all'
    ? bookings
    : bookings.filter(b => b.status === bookingFilter);

  const filteredRateCodes = rateCodeFilter === 'all'
    ? rateCodes
    : rateCodes.filter(rc => rc.category === rateCodeFilter);

  const filteredRateDist = rateDistFilter === 'all'
    ? rateDistributions
    : rateDistributions.filter(rd => rd.rateType.toLowerCase() === rateDistFilter.toLowerCase());

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <X className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-500 mt-2">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchConnectionsData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GDS Connectivity</h1>
          <p className="text-muted-foreground">Manage Global Distribution System connections, rate distribution, and booking retrieval</p>
        </div>
        <Button onClick={fetchMockData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Plug className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeConnections}<span className="text-sm font-normal text-muted-foreground">/3</span></p>
                <p className="text-xs text-muted-foreground">Active Connections</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalBookings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Bookings via GDS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Revenue from GDS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sm leading-6">
                  {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Last Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connections">
        <TabsList className="flex-wrap">
          <TabsTrigger value="connections">
            <Cable className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="rate-distribution">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Rate Distribution
          </TabsTrigger>
          <TabsTrigger value="booking-retrieval">
            <Download className="h-4 w-4 mr-2" />
            Booking Retrieval
          </TabsTrigger>
          <TabsTrigger value="rate-codes">
            <Tag className="h-4 w-4 mr-2" />
            Rate Codes
          </TabsTrigger>
        </TabsList>

        {/* ─── Connections Tab ─────────────────────────────────────────── */}
        <TabsContent value="connections" className="mt-4 space-y-4">
          {connections.map((conn) => {
            const ProviderIcon = getProviderIcon(conn.provider);
            const statusCfg = getStatusBadge(conn.status);
            return (
              <Card key={conn.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${getProviderColor(conn.provider)}`}>
                        <ProviderIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{conn.name}</CardTitle>
                        <CardDescription>
                          {conn.provider} &bull; PCC: {conn.pcc} &bull; Chain: {conn.chainCode}-{conn.hotelCode}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusCfg.className}>
                        {conn.status === 'active' && <Check className="h-3 w-3 mr-1" />}
                        {conn.status === 'error' && <X className="h-3 w-3 mr-1" />}
                        {statusCfg.label}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        <TestTube className="h-3 w-3 mr-1" />
                        {conn.lastSyncStatus}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Last Sync</p>
                      <p className="text-sm font-medium">
                        {conn.lastSync ? new Date(conn.lastSync).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bookings Retrieved</p>
                      <p className="text-sm font-medium">{conn.bookingsRetrieved.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                      <p className="text-sm font-medium">{formatCurrency(conn.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Auto Sync</p>
                      <Switch
                        checked={conn.autoSync}
                        onCheckedChange={(checked) => handleToggleAutoSync(conn.id, checked)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Actions</p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleTestConnection(conn.id)}>
                          <TestTube className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSyncNow(conn.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openConnectionConfig(conn)}>
                          <Settings className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rate Access Code:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{conn.rateAccessCode}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(conn.rateAccessCode); toast.success('Copied to clipboard'); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sync Interval:</span>
                      <span className="text-xs font-medium">Every {conn.syncInterval} min</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Commission:</span>
                      <span className="text-xs font-medium">{conn.commissionRate}%</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground mr-1">Features:</span>
                      {conn.features.inventory && <Badge variant="outline" className="text-xs">Inventory</Badge>}
                      {conn.features.rates && <Badge variant="outline" className="text-xs">Rates</Badge>}
                      {conn.features.bookings && <Badge variant="outline" className="text-xs">Bookings</Badge>}
                      {conn.features.restrictions && <Badge variant="outline" className="text-xs">Restrictions</Badge>}
                      {conn.features.updates && <Badge variant="outline" className="text-xs">Updates</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── Rate Distribution Tab ───────────────────────────────────── */}
        <TabsContent value="rate-distribution" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={rateDistFilter} onValueChange={setRateDistFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bar">BAR</SelectItem>
                  <SelectItem value="rack">RACK</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="negotiated">Negotiated</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => toast.info('Rate distribution export started')}>
              <Upload className="h-4 w-4 mr-2" />
              Distribute All
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate Code</TableHead>
                      <TableHead>Rate Name</TableHead>
                      <TableHead>GDS</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Single / Double</TableHead>
                      <TableHead>Room Types</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Last Distributed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRateDist.map((rd) => {
                      const statusCfg = getStatusBadge(rd.status);
                      return (
                        <TableRow key={rd.id} className={!rd.status ? 'opacity-50' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rd.rateCode}</code>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rd.gdsRateCode}</code>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{rd.rateName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{rd.gdsProvider}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRateTypeColor(rd.rateType)}>
                              {rd.rateType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatCurrency(rd.singleRate)}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-sm">{formatCurrency(rd.doubleRate)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {rd.roomTypes.slice(0, 2).map((rt, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{rt}</Badge>
                              ))}
                              {rd.roomTypes.length > 2 && (
                                <Badge variant="secondary" className="text-xs">+{rd.roomTypes.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={rd.roomsAvailable === 0 ? 'text-red-500' : ''}>{rd.roomsAvailable}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {rd.lastDistributed ? new Date(rd.lastDistributed).toLocaleString() : <span className="text-muted-foreground">Never</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Booking Retrieval Tab ───────────────────────────────────── */}
        <TabsContent value="booking-retrieval" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={bookingFilter} onValueChange={setBookingFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No-Show</SelectItem>
                  <SelectItem value="checked-in">Checked In</SelectItem>
                  <SelectItem value="checked-out">Checked Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => { toast.info('Retrieving latest bookings from all GDS...'); setTimeout(() => toast.success('Bookings retrieved successfully'), 2000); }}>
              <Download className="h-4 w-4 mr-2" />
              Retrieve All
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PNR</TableHead>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>GDS Source</TableHead>
                      <TableHead>Room Type</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Rate Code</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Segments</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => {
                      const statusCfg = getStatusBadge(booking.status);
                      return (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{booking.pnr}</code>
                          </TableCell>
                          <TableCell className="font-medium">{booking.guestName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{booking.gdsSource}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{booking.roomType}</TableCell>
                          <TableCell className="text-sm">{booking.checkIn}</TableCell>
                          <TableCell className="text-sm">{booking.checkOut}</TableCell>
                          <TableCell>
                            <code className="text-xs">{booking.rateCode}</code>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(booking.totalAmount)}</TableCell>
                          <TableCell className="text-center">{booking.segments}</TableCell>
                          <TableCell>
                            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Rate Codes Tab ──────────────────────────────────────────── */}
        <TabsContent value="rate-codes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={rateCodeFilter} onValueChange={setRateCodeFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="negotiated">Negotiated</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="consortia">Consortia</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="promo">Promotional</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={openNewRateCode}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rate Code
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Stay Limits</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Meal Plan</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRateCodes.map((rc) => {
                      const statusCfg = getStatusBadge(rc.status);
                      return (
                        <TableRow key={rc.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono font-semibold">{rc.code}</code>
                          </TableCell>
                          <TableCell className="font-medium max-w-[160px] truncate">{rc.name}</TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(rc.category)}>{rc.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {rc.discountType === 'percentage' ? (
                                <span className="text-sm font-medium">{rc.discount}%</span>
                              ) : rc.discountType === 'net' ? (
                                <span className="text-sm font-medium">Net Rate</span>
                              ) : (
                                <span className="text-sm font-medium">{formatCurrency(rc.discount)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{rc.minStay}–{rc.maxStay} nights</TableCell>
                          <TableCell className="text-sm">{rc.commission}%</TableCell>
                          <TableCell className="text-sm">{rc.mealPlan}</TableCell>
                          <TableCell className="text-sm font-medium">{rc.bookingCount}</TableCell>
                          <TableCell className="text-sm font-medium">{formatCurrency(rc.revenueGenerated)}</TableCell>
                          <TableCell>
                            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRateCode(rc)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleToggleRateCodeStatus(rc.id)}>
                                {rc.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => handleDeleteRateCode(rc.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Connection Config Dialog ──────────────────────────────────── */}
      <Dialog open={connectionDialog.open} onOpenChange={(open) => setConnectionDialog({ open, item: connectionDialog.item })}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Configure {connectionDialog.item?.name}</DialogTitle>
            <DialogDescription>
              Update connection settings for {connectionDialog.item?.provider} GDS
            </DialogDescription>
          </DialogHeader>
          {connectionDialog.item && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hotel Code</Label>
                  <Input defaultValue={connectionDialog.item.hotelCode} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Chain Code</Label>
                  <Input defaultValue={connectionDialog.item.chainCode} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pseudo City Code (PCC)</Label>
                  <Input defaultValue={connectionDialog.item.pcc} />
                </div>
                <div className="space-y-2">
                  <Label>Rate Access Code</Label>
                  <Input defaultValue={connectionDialog.item.rateAccessCode} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sync Interval</Label>
                  <Select defaultValue={connectionDialog.item.syncInterval.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <Input type="number" defaultValue={connectionDialog.item.commissionRate} />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label>Sync Features</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['inventory', 'rates', 'bookings', 'restrictions', 'updates'] as const).map((feature) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{feature}</span>
                      <Switch defaultChecked={connectionDialog.item.features[feature]} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectionDialog({ open: false, item: null })}>Cancel</Button>
            <Button onClick={() => { toast.success('Connection settings saved'); setConnectionDialog({ open: false, item: null }); }}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rate Code Create/Edit Dialog ─────────────────────────────── */}
      <Dialog open={rateCodeDialog.open} onOpenChange={(open) => setRateCodeDialog({ open, item: rateCodeDialog.item })}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rateCodeDialog.item ? 'Edit Rate Code' : 'Create Rate Code'}</DialogTitle>
            <DialogDescription>
              {rateCodeDialog.item ? 'Update GDS rate code configuration.' : 'Define a new GDS rate code for distribution.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate Code *</Label>
                <Input
                  placeholder="e.g., CORPSTD"
                  className="font-mono uppercase"
                  value={rateCodeForm.code}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Name *</Label>
                <Input
                  placeholder="e.g., Corporate Standard"
                  value={rateCodeForm.name}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={rateCodeForm.category} onValueChange={(v) => setRateCodeForm(f => ({ ...f, category: v as GDSRateCode['category'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="negotiated">Negotiated</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="consortia">Consortia</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="promo">Promotional</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meal Plan</Label>
                <Select value={rateCodeForm.mealPlan} onValueChange={(v) => setRateCodeForm(f => ({ ...f, mealPlan: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Room Only">Room Only</SelectItem>
                    <SelectItem value="Bed & Breakfast">Bed & Breakfast</SelectItem>
                    <SelectItem value="Half Board">Half Board</SelectItem>
                    <SelectItem value="Full Board">Full Board</SelectItem>
                    <SelectItem value="All Inclusive">All Inclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Describe this rate code..."
                value={rateCodeForm.description}
                onChange={(e) => setRateCodeForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={rateCodeForm.discountType} onValueChange={(v) => setRateCodeForm(f => ({ ...f, discountType: v as GDSRateCode['discountType'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="net">Net Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  placeholder="e.g., 15"
                  value={rateCodeForm.discount}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, discount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Commission (%)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={rateCodeForm.commission}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, commission: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Stay (nights)</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={rateCodeForm.minStay}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, minStay: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Stay (nights)</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={rateCodeForm.maxStay}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, maxStay: e.target.value }))}
                />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={rateCodeForm.validFrom}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input
                  type="date"
                  value={rateCodeForm.validTo}
                  onChange={(e) => setRateCodeForm(f => ({ ...f, validTo: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateCodeDialog({ open: false, item: null })}>Cancel</Button>
            <Button onClick={handleSaveRateCode}>
              <Save className="h-4 w-4 mr-2" />
              {rateCodeDialog.item ? 'Update Rate Code' : 'Create Rate Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
