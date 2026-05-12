'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
  Megaphone,
  RefreshCw,
  Settings,
  Check,
  X,
  Clock,
  DollarSign,
  TrendingUp,
  Target,
  Sparkles,
  Gift,
  Star,
  Zap,
  Heart,
  Crown,
  UtensilsCrossed,
  Bath,
  Wine,
  Coffee,
  Dumbbell,
  Car,
  Package,
  CalendarPlus,
  CalendarMinus,
  ArrowUpRight,
  Brain,
  Lightbulb,
  BarChart3,
  PieChart,
  Users,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Trophy,
  Rocket,
  Flame,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Copy,
  ExternalLink,
  Gem,
  TreePine,
  Camera,
  Music,
  Plane,
  MapPin,
  Sun,
  Snowflake,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  type: 'pre-arrival' | 'check-in' | 'in-stay' | 'post-stay';
  description: string;
  status: 'active' | 'paused' | 'draft' | 'completed';
  trigger: string;
  targetSegment: string;
  totalSent: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  startDate: string;
  endDate: string;
  offers: string[];
  priority: 'high' | 'medium' | 'low';
}

interface UpsellOffer {
  id: string;
  name: string;
  category: 'room-upgrade' | 'early-checkin' | 'late-checkout' | 'spa' | 'dining' | 'experience' | 'package' | 'amenity';
  description: string;
  originalPrice: number;
  upsellPrice: number;
  discount: number;
  image: string;
  status: 'active' | 'paused' | 'draft' | 'archived';
  timesSold: number;
  revenueGenerated: number;
  rating: number;
  popularity: number;
  targetAudience: string[];
  availability: string;
}

interface PerformanceMetric {
  month: string;
  revenue: number;
  conversions: number;
  sent: number;
  avgUpsell: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  segment: string;
  predictedConversion: number;
  estimatedRevenue: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  confidence: number;
  action: string;
}

interface UpsellStats {
  activeCampaigns: number;
  conversionRate: number;
  upsellRevenue: number;
  avgUpsellValue: number;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockCampaigns: Campaign[] = [
  {
    id: 'camp-1', name: 'Suite Upgrade Pre-Arrival', type: 'pre-arrival',
    description: 'Offer room upgrade to arriving guests 48 hours before check-in',
    status: 'active', trigger: '48h before check-in', targetSegment: 'All Guests',
    totalSent: 1245, conversions: 312, conversionRate: 25.1, revenue: 468000,
    startDate: '2025-01-15', endDate: '2025-12-31', offers: ['Suite Upgrade', 'Deluxe Upgrade'],
    priority: 'high',
  },
  {
    id: 'camp-2', name: 'Welcome Spa Package', type: 'check-in',
    description: 'Promote spa treatments during the check-in kiosk flow',
    status: 'active', trigger: 'At check-in', targetSegment: 'Leisure Travelers',
    totalSent: 892, conversions: 178, conversionRate: 19.9, revenue: 133500,
    startDate: '2025-02-01', endDate: '2025-12-31', offers: ['Couples Spa', 'Deep Tissue Massage'],
    priority: 'medium',
  },
  {
    id: 'camp-3', name: 'Dining Experience Upsell', type: 'in-stay',
    description: 'Push fine dining reservations to guests on day 2 of stay',
    status: 'active', trigger: 'Day 2 of stay', targetSegment: 'All Guests',
    totalSent: 1567, conversions: 424, conversionRate: 27.1, revenue: 254400,
    startDate: '2025-01-01', endDate: '2025-12-31', offers: ['Chef\'s Table', 'Rooftop Dinner'],
    priority: 'high',
  },
  {
    id: 'camp-4', name: 'Early Check-in Offer', type: 'pre-arrival',
    description: 'Offer early check-in to guests arriving on morning flights',
    status: 'active', trigger: '24h before check-in', targetSegment: 'Business Travelers',
    totalSent: 2341, conversions: 819, conversionRate: 35.0, revenue: 163800,
    startDate: '2025-03-01', endDate: '2025-12-31', offers: ['Early Check-in'],
    priority: 'high',
  },
  {
    id: 'camp-5', name: 'Late Checkout + Breakfast', type: 'in-stay',
    description: 'Offer late checkout with breakfast extension on last night',
    status: 'paused', trigger: 'Last night of stay', targetSegment: 'All Guests',
    totalSent: 978, conversions: 245, conversionRate: 25.1, revenue: 73500,
    startDate: '2025-04-01', endDate: '2025-09-30', offers: ['Late Checkout', 'Breakfast Extension'],
    priority: 'medium',
  },
  {
    id: 'camp-6', name: 'Airport Transfer Premium', type: 'check-in',
    description: 'Upgrade airport transfer to luxury vehicle at check-in',
    status: 'active', trigger: 'At check-in', targetSegment: 'International Guests',
    totalSent: 456, conversions: 137, conversionRate: 30.0, revenue: 68500,
    startDate: '2025-02-15', endDate: '2025-12-31', offers: ['Luxury Transfer'],
    priority: 'low',
  },
  {
    id: 'camp-7', name: 'Honeymoon Romance Package', type: 'pre-arrival',
    description: 'Curated romance package for honeymoon and anniversary guests',
    status: 'active', trigger: '72h before check-in', targetSegment: 'Couples',
    totalSent: 234, conversions: 98, conversionRate: 41.9, revenue: 98000,
    startDate: '2025-01-01', endDate: '2025-12-31', offers: ['Romance Package', 'Spa for Two'],
    priority: 'high',
  },
  {
    id: 'camp-8', name: 'Kids Activity Bundle', type: 'in-stay',
    description: 'Family activity add-ons during mid-stay for family bookings',
    status: 'draft', trigger: 'Day 1 of stay', targetSegment: 'Family Travelers',
    totalSent: 0, conversions: 0, conversionRate: 0, revenue: 0,
    startDate: '2025-07-01', endDate: '2025-08-31', offers: ['Kids Club', 'Family Adventure'],
    priority: 'low',
  },
];

const mockOffers: UpsellOffer[] = [
  {
    id: 'off-1', name: 'Deluxe King → Premium Suite', category: 'room-upgrade',
    description: 'Upgrade to our spacious Premium Suite with city views, separate living area, and premium amenities',
    originalPrice: 18500, upsellPrice: 3500, discount: 0, image: 'suite',
    status: 'active', timesSold: 412, revenueGenerated: 1442000, rating: 4.8, popularity: 92,
    targetAudience: ['All Guests', 'Business', 'Leisure'], availability: 'Subject to availability',
  },
  {
    id: 'off-2', name: 'Royal Suite Upgrade', category: 'room-upgrade',
    description: 'Experience the pinnacle of luxury with butler service, private terrace, and panoramic views',
    originalPrice: 35000, upsellPrice: 8000, discount: 0, image: 'royal',
    status: 'active', timesSold: 156, revenueGenerated: 1248000, rating: 4.9, popularity: 78,
    targetAudience: ['VIP', 'Celebration', 'Honeymoon'], availability: 'Limited availability',
  },
  {
    id: 'off-3', name: 'Early Check-in (from 10:00)', category: 'early-checkin',
    description: 'Arrive early and settle in comfortably before standard check-in time',
    originalPrice: 2500, upsellPrice: 1500, discount: 40, image: 'early',
    status: 'active', timesSold: 819, revenueGenerated: 1228500, rating: 4.5, popularity: 95,
    targetAudience: ['Business', 'Early Arrivals'], availability: 'Available most days',
  },
  {
    id: 'off-4', name: 'Late Check-out (until 15:00)', category: 'late-checkout',
    description: 'Extend your stay and enjoy a leisurely departure with late check-out',
    originalPrice: 2500, upsellPrice: 1200, discount: 52, image: 'late',
    status: 'active', timesSold: 645, revenueGenerated: 774000, rating: 4.6, popularity: 88,
    targetAudience: ['All Guests', 'Evening Flights'], availability: 'Subject to availability',
  },
  {
    id: 'off-5', name: 'Couples Spa Retreat', category: 'spa',
    description: '90-minute couples massage with aromatherapy, followed by relaxation in our spa suite',
    originalPrice: 8000, upsellPrice: 5500, discount: 31, image: 'spa',
    status: 'active', timesSold: 234, revenueGenerated: 1287000, rating: 4.9, popularity: 82,
    targetAudience: ['Couples', 'Honeymoon', 'Anniversary'], availability: 'Pre-booking required',
  },
  {
    id: 'off-6', name: 'Chef\'s Table Experience', category: 'dining',
    description: 'Exclusive 7-course tasting menu with wine pairing at our chef\'s table for two',
    originalPrice: 12000, upsellPrice: 8500, discount: 29, image: 'dining',
    status: 'active', timesSold: 178, revenueGenerated: 1513000, rating: 4.8, popularity: 76,
    targetAudience: ['Foodies', 'Couples', 'Celebration'], availability: 'Thu-Sat evenings',
  },
  {
    id: 'off-7', name: 'Heritage Walking Tour', category: 'experience',
    description: 'Guided half-day tour of the city\'s historic sites with a personal historian guide',
    originalPrice: 4000, upsellPrice: 2500, discount: 37, image: 'tour',
    status: 'active', timesSold: 189, revenueGenerated: 472500, rating: 4.7, popularity: 68,
    targetAudience: ['Leisure', 'Culture'], availability: 'Daily, weather permitting',
  },
  {
    id: 'off-8', name: 'Luxury Airport Transfer', category: 'amenity',
    description: 'Mercedes-Benz S-Class airport pickup/drop with meet & greet and refreshments',
    originalPrice: 5000, upsellPrice: 3000, discount: 40, image: 'transfer',
    status: 'active', timesSold: 342, revenueGenerated: 1026000, rating: 4.6, popularity: 85,
    targetAudience: ['Business', 'VIP', 'International'], availability: 'Pre-booking required',
  },
  {
    id: 'off-9', name: 'Sunrise Yoga Session', category: 'experience',
    description: 'Private rooftop yoga session at sunrise with a certified instructor and herbal tea',
    originalPrice: 3000, upsellPrice: 1800, discount: 40, image: 'yoga',
    status: 'active', timesSold: 267, revenueGenerated: 480600, rating: 4.7, popularity: 74,
    targetAudience: ['Wellness', 'Leisure', 'Couples'], availability: 'Daily at 6:00 AM',
  },
  {
    id: 'off-10', name: 'Romance Package', category: 'package',
    description: 'Room decoration, champagne, chocolates, rose petal turndown, and late check-out',
    originalPrice: 8000, upsellPrice: 4500, discount: 43, image: 'romance',
    status: 'active', timesSold: 198, revenueGenerated: 891000, rating: 4.8, popularity: 80,
    targetAudience: ['Couples', 'Honeymoon', 'Anniversary'], availability: 'Requires 24h notice',
  },
  {
    id: 'off-11', name: 'Rooftop Dinner for Two', category: 'dining',
    description: 'Private candlelit dinner on the rooftop terrace with a customized 5-course menu',
    originalPrice: 10000, upsellPrice: 7000, discount: 30, image: 'rooftop',
    status: 'paused', timesSold: 145, revenueGenerated: 1015000, rating: 4.9, popularity: 72,
    targetAudience: ['Couples', 'Celebration', 'VIP'], availability: 'Weather dependent',
  },
  {
    id: 'off-12', name: 'Deep Tissue Recovery Massage', category: 'spa',
    description: '60-minute deep tissue massage targeting recovery for travelers with jet lag',
    originalPrice: 5000, upsellPrice: 3500, discount: 30, image: 'massage',
    status: 'active', timesSold: 321, revenueGenerated: 1123500, rating: 4.6, popularity: 79,
    targetAudience: ['Business', 'Wellness', 'Long-haul'], availability: 'Daily 10 AM - 8 PM',
  },
];

const mockPerformance: PerformanceMetric[] = [
  { month: 'Jan', revenue: 385000, conversions: 198, sent: 890, avgUpsell: 1944 },
  { month: 'Feb', revenue: 412000, conversions: 215, sent: 945, avgUpsell: 1916 },
  { month: 'Mar', revenue: 478000, conversions: 256, sent: 1089, avgUpsell: 1867 },
  { month: 'Apr', revenue: 523000, conversions: 287, sent: 1234, avgUpsell: 1822 },
  { month: 'May', revenue: 567000, conversions: 312, sent: 1356, avgUpsell: 1817 },
  { month: 'Jun', revenue: 612000, conversions: 345, sent: 1478, avgUpsell: 1774 },
];

const mockRecommendations: AIRecommendation[] = [
  {
    id: 'ai-1', title: 'Monsoon Spa Retreat Bundle', segment: 'Wellness Travelers',
    description: 'Combine a 90-minute massage with a rain shower experience and herbal tea ceremony. High affinity detected for guests booking rooms with garden/pool views.',
    predictedConversion: 38.5, estimatedRevenue: 245000, priority: 'high',
    category: 'spa', confidence: 92, action: 'Create Campaign',
  },
  {
    id: 'ai-2', title: 'Business Express Package', segment: 'Corporate Travelers',
    description: 'Bundle early check-in + express laundry + breakfast-to-go for business travelers on 1-2 night stays. Pattern shows 73% of corporate guests miss breakfast.',
    predictedConversion: 42.1, estimatedRevenue: 189000, priority: 'high',
    category: 'package', confidence: 89, action: 'Create Offer',
  },
  {
    id: 'ai-3', title: 'Family Adventure Day Pass', segment: 'Family Travelers',
    description: 'Curated family day with kids club, family brunch, and afternoon activity. Seasonal spike detected: family bookings up 34% this quarter.',
    predictedConversion: 35.2, estimatedRevenue: 312000, priority: 'high',
    category: 'experience', confidence: 87, action: 'Create Campaign',
  },
  {
    id: 'ai-4', title: 'Romance Enhancement at Check-in', segment: 'Couples',
    description: 'Target guests with "couple" or "honeymoon" booking tags at check-in. Offer champagne and rose turndown. Current romance package converts 42% in pre-arrival.',
    predictedConversion: 45.0, estimatedRevenue: 156000, priority: 'medium',
    category: 'dining', confidence: 84, action: 'Create Offer',
  },
  {
    id: 'ai-5', title: 'Extended Stay Loyalty Perk', segment: 'Returning Guests',
    description: 'Offer free late checkout + spa voucher for stays of 4+ nights. Loyalty data shows returning guests spend 28% more on ancillary services.',
    predictedConversion: 55.3, estimatedRevenue: 98700, priority: 'medium',
    category: 'package', confidence: 81, action: 'Create Campaign',
  },
  {
    id: 'ai-6', title: 'Weekend Brunch Upgrade', segment: 'Leisure Travelers',
    description: 'Upgrade standard breakfast to premium brunch buffet for weekend stays. Brunch revenue on weekends is 3.2x higher than weekday breakfast.',
    predictedConversion: 31.7, estimatedRevenue: 134000, priority: 'low',
    category: 'dining', confidence: 78, action: 'Create Offer',
  },
  {
    id: 'ai-7', title: 'Jet Lag Recovery Kit', segment: 'International Travelers',
    description: 'Pre-arrival offer: welcome kit with sleep aid tea, eye mask, and 30-min neck massage. Booking data shows 68% of international arrivals before 6 AM.',
    predictedConversion: 29.4, estimatedRevenue: 87500, priority: 'low',
    category: 'amenity', confidence: 75, action: 'Create Offer',
  },
];

const mockStats: UpsellStats = {
  activeCampaigns: 5,
  conversionRate: 28.4,
  upsellRevenue: 3425000,
  avgUpsellValue: 2340,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    completed: { label: 'Completed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
  };
  return map[status] || map.draft;
}

function getCampaignTypeIcon(type: string) {
  switch (type) {
    case 'pre-arrival': return CalendarPlus;
    case 'check-in': return ShoppingCart;
    case 'in-stay': return Clock;
    case 'post-stay': return Star;
    default: return Megaphone;
  }
}

function getCampaignTypeColor(type: string) {
  switch (type) {
    case 'pre-arrival': return 'from-violet-500/10 to-violet-600/5 border-violet-500/20';
    case 'check-in': return 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20';
    case 'in-stay': return 'from-amber-500/10 to-amber-600/5 border-amber-500/20';
    case 'post-stay': return 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20';
    default: return 'from-gray-500/10 to-gray-600/5 border-gray-500/20';
  }
}

function getCategoryConfig(category: string) {
  const map: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
    'room-upgrade': { label: 'Room Upgrade', icon: Crown, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'early-checkin': { label: 'Early Check-in', icon: Sun, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    'late-checkout': { label: 'Late Check-out', icon: Clock, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    'spa': { label: 'Spa & Wellness', icon: Bath, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    'dining': { label: 'Dining', icon: UtensilsCrossed, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'experience': { label: 'Experience', icon: MapPin, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
    'package': { label: 'Package', icon: Package, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'amenity': { label: 'Amenity', icon: Gem, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  };
  return map[category] || { label: category, icon: Package, color: 'bg-gray-100 text-gray-700' };
}

function getPriorityConfig(priority: string) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    low: { label: 'Low', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  };
  return map[priority] || map.low;
}

function getOfferIcon(category: string) {
  switch (category) {
    case 'room-upgrade': return Crown;
    case 'early-checkin': return Sun;
    case 'late-checkout': return Clock;
    case 'spa': return Bath;
    case 'dining': return UtensilsCrossed;
    case 'experience': return MapPin;
    case 'package': return Package;
    case 'amenity': return Gem;
    default: return Gift;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UpsellEngine() {
  const t = useTranslations('marketing');
  const { formatCurrency } = useCurrency();

  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [offers, setOffers] = useState<UpsellOffer[]>(mockOffers);
  const [performance, setPerformance] = useState<PerformanceMetric[]>(mockPerformance);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(mockRecommendations);
  const [stats, setStats] = useState<UpsellStats>(mockStats);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [campaignDialog, setCampaignDialog] = useState<{ open: boolean; item: Campaign | null }>({ open: false, item: null });
  const [offerDialog, setOfferDialog] = useState<{ open: boolean; item: UpsellOffer | null }>({ open: false, item: null });

  // Load mock data
  const fetchMockData = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setCampaigns(mockCampaigns);
      setOffers(mockOffers);
      setPerformance(mockPerformance);
      setRecommendations(mockRecommendations);
      setStats(mockStats);
      setLoading(false);
    }, 600);
  }, []);

  // ─── Campaign handlers ──────────────────────────────────────────────────

  const handleToggleCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === 'active' ? 'paused' as const : 'active' as const } : c
    ));
    const camp = campaigns.find(c => c.id === id);
    toast.success(`Campaign ${camp?.status === 'active' ? 'paused' : 'activated'}`);
  };

  const handleDuplicateCampaign = (camp: Campaign) => {
    const newCamp = {
      ...camp,
      id: `camp-${Date.now()}`,
      name: `${camp.name} (Copy)`,
      status: 'draft' as const,
      totalSent: 0,
      conversions: 0,
      conversionRate: 0,
      revenue: 0,
    };
    setCampaigns(prev => [...prev, newCamp]);
    toast.success('Campaign duplicated');
  };

  // ─── Offer handlers ────────────────────────────────────────────────────

  const handleToggleOffer = (id: string) => {
    setOffers(prev => prev.map(o =>
      o.id === id ? { ...o, status: o.status === 'active' ? 'paused' as const : 'active' as const } : o
    ));
    toast.success('Offer status updated');
  };

  const handleDuplicateOffer = (offer: UpsellOffer) => {
    const newOffer = {
      ...offer,
      id: `off-${Date.now()}`,
      name: `${offer.name} (Copy)`,
      status: 'draft' as const,
      timesSold: 0,
      revenueGenerated: 0,
    };
    setOffers(prev => [...prev, newOffer]);
    toast.success('Offer duplicated');
  };

  // ─── Derived data ──────────────────────────────────────────────────────

  const topOffers = [...offers].sort((a, b) => b.revenueGenerated - a.revenueGenerated).slice(0, 5);
  const totalConversions = performance.reduce((sum, p) => sum + p.conversions, 0);
  const totalRevenue = performance.reduce((sum, p) => sum + p.revenue, 0);

  // ─── Render ─────────────────────────────────────────────────────────────

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
          <h1 className="text-2xl font-bold tracking-tight">Upsell Engine</h1>
          <p className="text-muted-foreground">Manage upsell campaigns, offer catalog, performance analytics, and AI-powered recommendations</p>
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
                <Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Target className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
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
                <p className="text-2xl font-bold">{formatCurrency(stats.upsellRevenue)}</p>
                <p className="text-xs text-muted-foreground">Upsell Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgUpsellValue)}</p>
                <p className="text-xs text-muted-foreground">Avg. Upsell Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campaigns">
        <TabsList className="flex-wrap">
          <TabsTrigger value="campaigns">
            <Megaphone className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="offers">
            <Gift className="h-4 w-4 mr-2" />
            Offer Catalog
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="ai-recommendations">
            <Brain className="h-4 w-4 mr-2" />
            AI Recommendations
          </TabsTrigger>
        </TabsList>

        {/* ─── Campaigns Tab ──────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="mt-4 space-y-6">
          {/* Campaign Type Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['pre-arrival', 'check-in', 'in-stay'] as const).map((type) => {
              const typeCampaigns = campaigns.filter(c => c.type === type);
              const activeCount = typeCampaigns.filter(c => c.status === 'active').length;
              const totalRevenue = typeCampaigns.reduce((s, c) => s + c.revenue, 0);
              const totalConversions = typeCampaigns.reduce((s, c) => s + c.conversions, 0);
              const TypeIcon = getCampaignTypeIcon(type);
              return (
                <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => toast.info(`Showing ${type} campaigns`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${getCampaignTypeColor(type)}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{type.replace('-', '-')}</p>
                        <p className="text-xs text-muted-foreground">{activeCount} active / {typeCampaigns.length} total</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Conversions</span>
                        <p className="font-semibold">{totalConversions.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Revenue</span>
                        <p className="font-semibold">{formatCurrency(totalRevenue)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Campaign Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => {
              const TypeIcon = getCampaignTypeIcon(camp.type);
              const statusCfg = getStatusBadge(camp.status);
              const priorityCfg = getPriorityConfig(camp.priority);
              return (
                <Card key={camp.id} className={`relative ${camp.status === 'draft' ? 'opacity-70' : ''}`}>
                  {camp.priority === 'high' && camp.status === 'active' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-lg" />
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-2 rounded-lg bg-gradient-to-br shrink-0 ${getCampaignTypeColor(camp.type)}`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{camp.name}</CardTitle>
                          <CardDescription className="text-xs">{camp.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={priorityCfg.className}>{priorityCfg.label}</Badge>
                        <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Trigger</p>
                        <p className="text-sm font-medium">{camp.trigger}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="text-sm font-medium">{camp.targetSegment}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sent / Converted</p>
                        <p className="text-sm font-medium">{camp.totalSent.toLocaleString()} / <span className="text-emerald-600 dark:text-emerald-400">{camp.conversions.toLocaleString()}</span></p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-sm font-semibold">{formatCurrency(camp.revenue)}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Conversion Rate</span>
                        <span className="font-semibold">{camp.conversionRate}%</span>
                      </div>
                      <Progress value={Math.min(camp.conversionRate, 100)} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {camp.offers.map((offer, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{offer}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <span>{camp.startDate} → {camp.endDate}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggleCampaign(camp.id)}>
                          {camp.status === 'active' ? <><Pause className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Activate</>}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDuplicateCampaign(camp)}>
                          <Copy className="h-3 w-3 mr-1" />Duplicate
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCampaignDialog({ open: true, item: camp })}>
                          <Settings className="h-3 w-3 mr-1" />Settings
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Offer Catalog Tab ──────────────────────────────────────── */}
        <TabsContent value="offers" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{offers.filter(o => o.status === 'active').length} active offers in catalog</p>
            <Button size="sm" onClick={() => toast.info('Create offer form coming soon')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((offer) => {
              const OfferIcon = getOfferIcon(offer.category);
              const catConfig = getCategoryConfig(offer.category);
              const statusCfg = getStatusBadge(offer.status);
              return (
                <Card key={offer.id} className={`relative overflow-hidden ${offer.status !== 'active' ? 'opacity-70' : ''}`}>
                  {/* Gradient top bar based on category */}
                  <div className={`h-1.5 bg-gradient-to-r ${catConfig.color.replace('bg-', 'from-').replace('/30', '/80').replace('/20', '/60').split(' ').slice(0, 1)[0]}`} />

                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-2 rounded-lg ${catConfig.color}`}>
                          <OfferIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-tight truncate">{offer.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{catConfig.label}</Badge>
                        </div>
                      </div>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{offer.description}</p>

                    {/* Pricing */}
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-lg font-bold">{formatCurrency(offer.upsellPrice)}</span>
                        {offer.discount > 0 && (
                          <span className="text-xs text-muted-foreground line-through ml-2">{formatCurrency(offer.originalPrice)}</span>
                        )}
                      </div>
                      {offer.discount > 0 && (
                        <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {offer.discount}% OFF
                        </Badge>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Sold</p>
                        <p className="text-sm font-bold">{offer.timesSold}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-sm font-bold">{formatCurrency(offer.revenueGenerated)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Rating</p>
                        <div className="flex items-center justify-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold">{offer.rating}</span>
                        </div>
                      </div>
                    </div>

                    {/* Popularity bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Popularity</span>
                        <span className="font-medium">{offer.popularity}%</span>
                      </div>
                      <Progress value={offer.popularity} className="h-1.5" />
                    </div>

                    {/* Target audience */}
                    <div className="flex flex-wrap gap-1">
                      {offer.targetAudience.slice(0, 2).map((ta, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{ta}</Badge>
                      ))}
                      {offer.targetAudience.length > 2 && (
                        <Badge variant="outline" className="text-[10px]">+{offer.targetAudience.length - 2}</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => handleToggleOffer(offer.id)}>
                        {offer.status === 'active' ? <><Pause className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Activate</>}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDuplicateOffer(offer)}>
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOfferDialog({ open: true, item: offer })}>
                        <Settings className="h-3 w-3 mr-1" />Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Performance Tab ────────────────────────────────────────── */}
        <TabsContent value="performance" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Revenue (YTD)</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</p>
                <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+18.4% vs last year</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Conversions</p>
                <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
                <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+22.1% vs last year</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Avg Conversion Rate</p>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{(totalConversions / Math.max(1, performance.reduce((s, p) => s + p.sent, 0)) * 100).toFixed(1)}%</p>
                <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+3.2pp improvement</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Revenue per Conversion</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(totalRevenue / Math.max(1, totalConversions))}</p>
                <div className="flex items-center justify-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>-2.1% (improving avg)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Upsell Revenue & Conversions
              </CardTitle>
              <CardDescription>Revenue and conversion trends over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: '12px' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                        if (name === 'conversions') return [value, 'Conversions'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar yAxisId="right" dataKey="conversions" fill="hsl(180, 70%, 50%)" radius={[4, 4, 0, 0]} name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Offers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Performing Offers
              </CardTitle>
              <CardDescription>Ranked by total revenue generated</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Times Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Popularity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOffers.map((offer, idx) => {
                    const catConfig = getCategoryConfig(offer.category);
                    return (
                      <TableRow key={offer.id}>
                        <TableCell className="font-bold text-muted-foreground">
                          {idx === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                          {idx === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                          {idx === 2 && <Trophy className="h-4 w-4 text-amber-700" />}
                          {idx > 2 && <span>{idx + 1}</span>}
                        </TableCell>
                        <TableCell className="font-medium">{offer.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {catConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{offer.timesSold.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(offer.revenueGenerated)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>{offer.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={offer.popularity} className="h-2 w-16" />
                            <span className="text-xs text-muted-foreground">{offer.popularity}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Campaign Performance Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Campaign Revenue Attribution
              </CardTitle>
              <CardDescription>Revenue breakdown by campaign</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Conv. Rate</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Rev % Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...campaigns].sort((a, b) => b.revenue - a.revenue).map((camp) => {
                      const TypeIcon = getCampaignTypeIcon(camp.type);
                      const share = stats.upsellRevenue > 0 ? (camp.revenue / (campaigns.reduce((s, c) => s + c.revenue, 0)) * 100) : 0;
                      return (
                        <TableRow key={camp.id}>
                          <TableCell className="font-medium">{camp.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs capitalize">{camp.type.replace('-', '-')}</span>
                            </div>
                          </TableCell>
                          <TableCell>{camp.totalSent.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">{camp.conversions.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(camp.conversionRate, 100)} className="h-2 w-16" />
                              <span className="text-xs font-medium">{camp.conversionRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">{formatCurrency(camp.revenue)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={share} className="h-2 w-16" />
                              <span className="text-xs font-medium">{share.toFixed(1)}%</span>
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

        {/* ─── AI Recommendations Tab ─────────────────────────────────── */}
        <TabsContent value="ai-recommendations" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-violet-100 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg">
              <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI-Powered Insights</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {recommendations.length} recommendations based on guest behavior analysis, booking patterns, and market trends
            </p>
          </div>

          <div className="space-y-4">
            {recommendations.map((rec) => {
              const priorityCfg = getPriorityConfig(rec.priority);
              const RecIcon = getOfferIcon(rec.category) || Lightbulb;
              return (
                <Card key={rec.id} className="overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Icon column */}
                    <div className="lg:w-2 bg-gradient-to-b from-violet-500 to-emerald-500 shrink-0" />

                    <div className="flex-1 p-4 sm:p-6 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/10 shrink-0">
                            <RecIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-lg leading-tight">{rec.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{rec.segment}</Badge>
                              <Badge variant="outline" className="text-xs capitalize">{rec.category}</Badge>
                              <Badge className={priorityCfg.className}>{priorityCfg.label} Priority</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" onClick={() => toast.success(`"${rec.title}" campaign creation initiated`)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {rec.action}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toast.info('Recommendation dismissed')}>
                            Dismiss
                          </Button>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground">{rec.description}</p>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Predicted Conversion</p>
                          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{rec.predictedConversion}%</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Est. Monthly Revenue</p>
                          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(rec.estimatedRevenue)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Confidence Score</p>
                          <div className="flex items-center gap-2">
                            <Progress value={rec.confidence} className="h-2 flex-1" />
                            <span className="text-sm font-bold">{rec.confidence}%</span>
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Target Segment</p>
                          <p className="text-sm font-semibold">{rec.segment}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Campaign Settings Dialog ──────────────────────────────────── */}
      <Dialog open={campaignDialog.open} onOpenChange={(open) => setCampaignDialog({ open, item: campaignDialog.item })}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Campaign Settings</DialogTitle>
            <DialogDescription>
              Configure settings for {campaignDialog.item?.name}
            </DialogDescription>
          </DialogHeader>
          {campaignDialog.item && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input defaultValue={campaignDialog.item.name} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue={campaignDialog.item.type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre-arrival">Pre-Arrival</SelectItem>
                      <SelectItem value="check-in">Check-In</SelectItem>
                      <SelectItem value="in-stay">In-Stay</SelectItem>
                      <SelectItem value="post-stay">Post-Stay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Input defaultValue={campaignDialog.item.trigger} />
              </div>
              <div className="space-y-2">
                <Label>Target Segment</Label>
                <Select defaultValue={campaignDialog.item.targetSegment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Guests">All Guests</SelectItem>
                    <SelectItem value="Business Travelers">Business Travelers</SelectItem>
                    <SelectItem value="Leisure Travelers">Leisure Travelers</SelectItem>
                    <SelectItem value="Couples">Couples</SelectItem>
                    <SelectItem value="Family Travelers">Family Travelers</SelectItem>
                    <SelectItem value="International Guests">International Guests</SelectItem>
                    <SelectItem value="VIP">VIP Guests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select defaultValue={campaignDialog.item.priority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" defaultValue={campaignDialog.item.startDate} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" defaultValue={campaignDialog.item.endDate} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialog({ open: false, item: null })}>Cancel</Button>
            <Button onClick={() => { toast.success('Campaign settings saved'); setCampaignDialog({ open: false, item: null }); }}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Offer Settings Dialog ────────────────────────────────────── */}
      <Dialog open={offerDialog.open} onOpenChange={(open) => setOfferDialog({ open, item: offerDialog.item })}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Offer Settings</DialogTitle>
            <DialogDescription>
              Configure offer details for {offerDialog.item?.name}
            </DialogDescription>
          </DialogHeader>
          {offerDialog.item && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Offer Name</Label>
                <Input defaultValue={offerDialog.item.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select defaultValue={offerDialog.item.category}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room-upgrade">Room Upgrade</SelectItem>
                      <SelectItem value="early-checkin">Early Check-in</SelectItem>
                      <SelectItem value="late-checkout">Late Check-out</SelectItem>
                      <SelectItem value="spa">Spa & Wellness</SelectItem>
                      <SelectItem value="dining">Dining</SelectItem>
                      <SelectItem value="experience">Experience</SelectItem>
                      <SelectItem value="package">Package</SelectItem>
                      <SelectItem value="amenity">Amenity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={offerDialog.item.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input defaultValue={offerDialog.item.description} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Original Price</Label>
                  <Input type="number" defaultValue={offerDialog.item.originalPrice} />
                </div>
                <div className="space-y-2">
                  <Label>Upsell Price</Label>
                  <Input type="number" defaultValue={offerDialog.item.upsellPrice} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Availability</Label>
                <Input defaultValue={offerDialog.item.availability} />
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Performance Summary:</strong></p>
                <p>Times Sold: {offerDialog.item.timesSold.toLocaleString()}</p>
                <p>Revenue Generated: {formatCurrency(offerDialog.item.revenueGenerated)}</p>
                <p>Rating: {offerDialog.item.rating}/5.0 ({offerDialog.item.popularity}% popularity)</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialog({ open: false, item: null })}>Cancel</Button>
            <Button onClick={() => { toast.success('Offer settings saved'); setOfferDialog({ open: false, item: null }); }}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
