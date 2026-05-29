'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Crown,
  Star,
  Medal,
  Award,
  Bell,
  BellRing,
  UserCheck,
  Gift,
  Cake,
  Heart,
  Repeat,
  DollarSign,
  Moon,
  Coffee,
  Sparkles,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Mail,
  Smartphone,
  Monitor,
  ChevronRight,
  Calendar,
  BedDouble,
  Utensils,
  Pill,
  Hotel,
  LogIn,
  Eye,
  Settings,
  Filter,
  Search,
  Zap,
  FileDown,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type VipTier = 'platinum' | 'gold' | 'silver' | 'bronze';
type AlertType = 'check_in' | 'birthday' | 'anniversary' | 'repeat_guest' | 'high_spend';
type NotificationChannel = 'front_desk' | 'sms' | 'email';

interface TierBenefit {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface VipTierConfig {
  tier: VipTier;
  label: string;
  color: string;
  bgColor: string;
  gradientFrom: string;
  gradientTo: string;
  iconBg: string;
  minSpend: number;
  minNights: number;
  minVisits: number;
  minPoints: number;
  benefits: TierBenefit[];
}

interface VipGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tier: VipTier;
  totalSpent: number;
  totalNights: number;
  totalVisits: number;
  loyaltyPoints: number;
  avatar?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomNumber?: string;
  roomType?: string;
  company?: string;
  dateOfBirth?: string;
  anniversary?: string;
  dietaryPreference?: string;
  pillowPreference?: string;
  roomPreference?: string;
  allergies?: string;
  specialRequests?: string;
  previousFeedback?: { stay: string; rating: number; comment: string }[];
  tags?: string[];
}

interface RecognitionRule {
  id: string;
  name: string;
  description: string;
  alertType: AlertType;
  triggerCondition: string;
  channels: NotificationChannel[];
  isActive: boolean;
  tierFilter: VipTier[];
}

interface AlertLogEntry {
  id: string;
  timestamp: string;
  guestName: string;
  guestTier: VipTier;
  alertType: AlertType;
  message: string;
  channel: NotificationChannel;
  acknowledgedBy?: string;
  actionTaken?: string;
}

// ============================================================
// Constants
// ============================================================

const TIER_CONFIG: Record<VipTier, VipTierConfig> = {
  platinum: {
    tier: 'platinum',
    label: 'Platinum',
    color: 'text-slate-700 dark:text-slate-200',
    bgColor: 'bg-slate-200 dark:bg-slate-700',
    gradientFrom: 'from-slate-100',
    gradientTo: 'to-slate-200',
    iconBg: 'bg-slate-500',
    minSpend: 50000,
    minNights: 50,
    minVisits: 20,
    minPoints: 50000,
    benefits: [
      { id: 'b1', name: 'Presidential Upgrade', icon: <Crown className="h-4 w-4" />, description: 'Complimentary upgrade to Presidential Suite' },
      { id: 'b2', name: 'Late Checkout (6PM)', icon: <Clock className="h-4 w-4" />, description: 'Extended checkout until 6:00 PM' },
      { id: 'b3', name: 'Welcome Amenity', icon: <Gift className="h-4 w-4" />, description: 'Premium welcome basket with champagne' },
      { id: 'b4', name: 'Lounge Access', icon: <Coffee className="h-4 w-4" />, description: '24/7 exclusive executive lounge' },
      { id: 'b5', name: 'Spa Discount 50%', icon: <Sparkles className="h-4 w-4" />, description: 'Half-price on all spa treatments' },
      { id: 'b6', name: 'Personal Butler', icon: <UserCheck className="h-4 w-4" />, description: 'Dedicated butler service' },
      { id: 'b7', name: 'Airport Transfer', icon: <Hotel className="h-4 w-4" />, description: 'Complimentary luxury airport transfer' },
    ],
  },
  gold: {
    tier: 'gold',
    label: 'Gold',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900',
    gradientFrom: 'from-amber-50',
    gradientTo: 'to-amber-100',
    iconBg: 'bg-amber-500',
    minSpend: 25000,
    minNights: 25,
    minVisits: 10,
    minPoints: 25000,
    benefits: [
      { id: 'b1', name: 'Suite Upgrade', icon: <Crown className="h-4 w-4" />, description: 'Complimentary upgrade to Suite' },
      { id: 'b2', name: 'Late Checkout (4PM)', icon: <Clock className="h-4 w-4" />, description: 'Extended checkout until 4:00 PM' },
      { id: 'b3', name: 'Welcome Amenity', icon: <Gift className="h-4 w-4" />, description: 'Welcome fruit basket & wine' },
      { id: 'b4', name: 'Lounge Access', icon: <Coffee className="h-4 w-4" />, description: 'Executive lounge during stay' },
      { id: 'b5', name: 'Spa Discount 25%', icon: <Sparkles className="h-4 w-4" />, description: '25% off spa treatments' },
    ],
  },
  silver: {
    tier: 'silver',
    label: 'Silver',
    color: 'text-gray-600 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    gradientFrom: 'from-gray-50',
    gradientTo: 'to-gray-100',
    iconBg: 'bg-gray-400',
    minSpend: 10000,
    minNights: 10,
    minVisits: 5,
    minPoints: 10000,
    benefits: [
      { id: 'b1', name: 'Room Upgrade', icon: <Crown className="h-4 w-4" />, description: 'Upgrade to next room category' },
      { id: 'b2', name: 'Late Checkout (2PM)', icon: <Clock className="h-4 w-4" />, description: 'Extended checkout until 2:00 PM' },
      { id: 'b3', name: 'Welcome Drink', icon: <Gift className="h-4 w-4" />, description: 'Complimentary welcome drink' },
      { id: 'b4', name: 'Spa Discount 15%', icon: <Sparkles className="h-4 w-4" />, description: '15% off spa treatments' },
    ],
  },
  bronze: {
    tier: 'bronze',
    label: 'Bronze',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    gradientFrom: 'from-orange-50',
    gradientTo: 'to-orange-100',
    iconBg: 'bg-orange-600',
    minSpend: 3000,
    minNights: 3,
    minVisits: 2,
    minPoints: 3000,
    benefits: [
      { id: 'b1', name: 'Late Checkout (1PM)', icon: <Clock className="h-4 w-4" />, description: 'Late checkout until 1:00 PM' },
      { id: 'b2', name: 'Welcome Drink', icon: <Gift className="h-4 w-4" />, description: 'Complimentary welcome beverage' },
      { id: 'b3', name: 'Spa Discount 10%', icon: <Sparkles className="h-4 w-4" />, description: '10% off spa treatments' },
    ],
  },
};

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  check_in: { label: 'Check-in Alert', icon: <LogIn className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', description: 'VIP guest checking in today' },
  birthday: { label: 'Birthday Alert', icon: <Cake className="h-4 w-4" />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', description: 'Guest birthday during stay' },
  anniversary: { label: 'Anniversary', icon: <Heart className="h-4 w-4" />, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300', description: 'Guest anniversary during stay' },
  repeat_guest: { label: 'Repeat Guest', icon: <Repeat className="h-4 w-4" />, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300', description: 'Guest has stayed 3+ times' },
  high_spend: { label: 'High Spend', icon: <DollarSign className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', description: 'Guest spending exceeds threshold' },
};

const NOTIFICATION_CHANNEL_CONFIG: Record<NotificationChannel, { label: string; icon: React.ReactNode }> = {
  front_desk: { label: 'Front Desk Popup', icon: <Monitor className="h-4 w-4" /> },
  sms: { label: 'SMS to Staff', icon: <Smartphone className="h-4 w-4" /> },
  email: { label: 'Email to GM', icon: <Mail className="h-4 w-4" /> },
};

// VIP_GUESTS removed — all data now comes from /api/guests/vip endpoint

const DEFAULT_RECOGNITION_RULES: RecognitionRule[] = [
  {
    id: 'rule-1', name: 'VIP Check-in Greeting', description: 'Alert front desk when any VIP checks in',
    alertType: 'check_in', triggerCondition: 'Guest checks in AND tier is Silver or above',
    channels: ['front_desk', 'sms'], isActive: true, tierFilter: ['silver', 'gold', 'platinum'],
  },
  {
    id: 'rule-2', name: 'Birthday Surprise', description: 'Prepare birthday amenities when VIP has birthday during stay',
    alertType: 'birthday', triggerCondition: 'Guest check-in date within 7 days of birthday',
    channels: ['front_desk', 'email'], isActive: true, tierFilter: ['gold', 'platinum'],
  },
  {
    id: 'rule-3', name: 'Anniversary Celebration', description: 'Arrange special setup for guest anniversary',
    alertType: 'anniversary', triggerCondition: 'Guest anniversary falls within stay dates',
    channels: ['front_desk', 'email'], isActive: true, tierFilter: ['gold', 'platinum'],
  },
  {
    id: 'rule-4', name: 'Loyal Return Guest', description: 'Welcome repeat guests with special recognition',
    alertType: 'repeat_guest', triggerCondition: 'Guest has 3+ previous stays',
    channels: ['front_desk'], isActive: true, tierFilter: ['bronze', 'silver', 'gold', 'platinum'],
  },
  {
    id: 'rule-5', name: 'High-Spend Recognition', description: 'GM notified when guest total spend exceeds $10,000',
    alertType: 'high_spend', triggerCondition: 'Guest cumulative spend exceeds $10,000',
    channels: ['email'], isActive: true, tierFilter: ['gold', 'platinum'],
  },
];

const INITIAL_ALERT_LOG: AlertLogEntry[] = [];

// ============================================================
// Helpers
// ============================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

function getTierBadge(tier: VipTier): React.ReactNode {
  const config = TIER_CONFIG[tier];
  const icon = tier === 'platinum' ? <Crown className="h-3 w-3" /> : tier === 'gold' ? <Star className="h-3 w-3" /> : tier === 'silver' ? <Medal className="h-3 w-3" /> : <Award className="h-3 w-3" />;
  return (
    <Badge className={`${config.bgColor} ${config.color} gap-1`}>
      {icon}
      {config.label}
    </Badge>
  );
}

function getRatingStars(rating: number): React.ReactNode {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function VipRecognition() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [rules, setRules] = useState<RecognitionRule[]>(DEFAULT_RECOGNITION_RULES);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<VipTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<VipGuest | null>(null);
  const [isGuestDialogOpen, setIsGuestDialogOpen] = useState(false);
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>(INITIAL_ALERT_LOG);
  const [vipGuests, setVipGuests] = useState<VipGuest[]>([]);
  const [vipLoading, setVipLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Fetch real VIP guests and alert log
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setVipLoading(true);
      setAlertsLoading(true);
      setError(null);
      try {
        const [guestsRes, alertsRes, rulesRes] = await Promise.allSettled([
          fetch('/api/guests/vip'),
          fetch('/api/guests/vip/alert-log'),
          fetch('/api/guests/vip/rules'),
        ]);
        if (cancelled) return;
        // VIP guests
        if (guestsRes.status === 'fulfilled' && guestsRes.value.ok) {
          const data = await guestsRes.value.json();
          const items = Array.isArray(data) ? data : data.guests || data.data || [];
          const mapped: VipGuest[] = items.map((g: Record<string, unknown>) => ({
            id: g.id || `guest-${Math.random().toString(36).slice(2, 9)}`,
            firstName: g.firstName || g.first_name || '',
            lastName: g.lastName || g.last_name || '',
            email: g.email || '',
            phone: g.phone || '',
            tier: (g.tier || g.loyaltyTier || g.loyalty_tier || 'silver') as VipTier,
            totalSpent: typeof g.totalSpent === 'number' ? g.totalSpent : typeof g.total_spent === 'number' ? g.total_spent : 0,
            totalNights: typeof g.totalNights === 'number' ? g.totalNights : typeof g.total_nights === 'number' ? g.total_nights : 0,
            totalVisits: typeof g.totalVisits === 'number' ? g.totalVisits : typeof g.total_visits === 'number' ? g.total_visits : 0,
            loyaltyPoints: typeof g.loyaltyPoints === 'number' ? g.loyaltyPoints : typeof g.loyalty_points === 'number' ? g.loyalty_points : 0,
            avatar: g.avatar || undefined,
            checkInDate: g.checkInDate || g.check_in_date || undefined,
            checkOutDate: g.checkOutDate || g.check_out_date || undefined,
            roomNumber: g.roomNumber || g.room_number || undefined,
            roomType: g.roomType || g.room_type || undefined,
            company: g.company || undefined,
            dateOfBirth: g.dateOfBirth || g.date_of_birth || g.dob || undefined,
            anniversary: g.anniversary || undefined,
            dietaryPreference: g.dietaryPreference || g.dietary_preference || (g.preferences as Record<string, unknown>)?.dietaryPreference || (g.preferences as Record<string, unknown>)?.dietary_preference || undefined,
            pillowPreference: g.pillowPreference || g.pillow_preference || (g.preferences as Record<string, unknown>)?.pillowPreference || (g.preferences as Record<string, unknown>)?.pillow_preference || undefined,
            roomPreference: g.roomPreference || g.room_preference || (g.preferences as Record<string, unknown>)?.roomPreference || (g.preferences as Record<string, unknown>)?.room_preference || undefined,
            allergies: g.allergies || (g.preferences as Record<string, unknown>)?.allergies || undefined,
            specialRequests: g.specialRequests || g.special_requests || (g.preferences as Record<string, unknown>)?.specialRequests || (g.preferences as Record<string, unknown>)?.special_requests || undefined,
            previousFeedback: g.previousFeedback || g.previous_feedback || [],
            tags: g.tags || undefined,
          }));
          setVipGuests(mapped);
        }
        // Alert log
        if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
          const data = await alertsRes.value.json();
          const items = Array.isArray(data) ? data : data.alerts || data.entries || [];
          if (items.length > 0) {
            setAlertLog(items.map((a: Record<string, unknown>) => ({
              id: a.id || `log-${a.id}`,
              timestamp: a.timestamp ? String(a.timestamp) : a.createdAt ? new Date(a.createdAt).toISOString() : format(new Date(), 'yyyy-MM-dd HH:mm'),
              guestName: a.guestName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown',
              guestTier: a.guestTier || a.tier || 'silver',
              alertType: a.alertType || a.type || 'check_in',
              message: a.message || a.description || '',
              channel: a.channel || 'front_desk',
              acknowledgedBy: a.acknowledgedBy || a.staffName || undefined,
              actionTaken: a.actionTaken || undefined,
            })));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load VIP data');
      } finally {
        // Persisted rules from API (fall back to defaults if empty)
        if (rulesRes.status === 'fulfilled' && rulesRes.value.ok) {
          const rulesData = await rulesRes.value.json();
          const items: RecognitionRule[] = Array.isArray(rulesData.data)
            ? rulesData.data
            : Array.isArray(rulesData) ? rulesData : [];
          if (items.length > 0) {
            setRules(items);
          } else {
            // No persisted rules yet — seed defaults to the database
            for (const defaultRule of DEFAULT_RECOGNITION_RULES) {
              fetch('/api/guests/vip/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(defaultRule),
              }).catch(() => { /* seed failure is non-critical */ });
            }
          }
        }
        setRulesLoading(false);
        if (!cancelled) { setVipLoading(false); setAlertsLoading(false); }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // PRODUCTION: Use API guests only — no fallback to hardcoded data
  const activeGuests = vipGuests;

  // Filter guests
  const filteredGuests = useMemo(() => {
    let guests = vipGuests;
    if (selectedTier !== 'all') {
      guests = guests.filter(g => g.tier === selectedTier);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      guests = guests.filter(g =>
        `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.company?.toLowerCase().includes(q) ||
        g.roomNumber?.includes(q)
      );
    }
    return guests;
  }, [vipGuests, selectedTier, searchQuery]);

  const todaysArrivals = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return vipGuests.filter(g => g.checkInDate === today).sort((a, b) => {
      const order: Record<VipTier, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
      return order[a.tier] - order[b.tier];
    });
  }, [vipGuests]);

  const tierCounts = useMemo(() => ({
    platinum: vipGuests.filter(g => g.tier === 'platinum').length,
    gold: vipGuests.filter(g => g.tier === 'gold').length,
    silver: vipGuests.filter(g => g.tier === 'silver').length,
    bronze: vipGuests.filter(g => g.tier === 'bronze').length,
  }), [vipGuests]);

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const newActive = !rule.isActive;
    // Optimistic update
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: newActive } : r));

    // Persist toggle to the database via API
    try {
      const res = await fetch(`/api/guests/vip/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        // Revert on failure
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !newActive } : r));
        toast.error(`Failed to update rule "${rule.name}"`);
        return;
      }
    } catch {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !newActive } : r));
      toast.error(`Failed to update rule "${rule.name}"`);
      return;
    }

    toast.success(`Rule "${rule.name}" ${newActive ? 'disabled' : 'enabled'}`);
  };

  const handleOpenGuest = (guest: VipGuest) => {
    setSelectedGuest(guest);
    setIsGuestDialogOpen(true);
  };

  if (vipLoading && vipGuests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading VIP guests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            VIP Recognition Alerts
          </h2>
          <p className="text-muted-foreground">Guest recognition system for VIP loyalty management</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Crown className="h-3.5 w-3.5 mr-1 text-slate-500" /> {tierCounts.platinum}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Star className="h-3.5 w-3.5 mr-1 text-amber-500" /> {tierCounts.gold}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Medal className="h-3.5 w-3.5 mr-1 text-gray-400" /> {tierCounts.silver}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Award className="h-3.5 w-3.5 mr-1 text-orange-500" /> {tierCounts.bronze}
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Today&apos;s Arrivals</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{todaysArrivals.length}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">VIP guests arriving</p>
              </div>
              <div className="p-3 rounded-full bg-slate-300 dark:bg-slate-600">
                <LogIn className="h-6 w-6 text-slate-700 dark:text-slate-200" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Active Rules</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{rules.filter(r => r.isActive).length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">of {rules.length} total</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Settings className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Alerts Sent Today</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {alertLog.filter(l => l.timestamp.startsWith(format(new Date(), 'yyyy-MM-dd'))).length}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Staff notified</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Bell className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Total VIP Guests</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{vipGuests.length}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Across all tiers</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <UserCheck className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1.5"><Eye className="h-3.5 w-3.5 hidden sm:block" />Dashboard</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-1.5"><Award className="h-3.5 w-3.5 hidden sm:block" />Tier Config</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Shield className="h-3.5 w-3.5 hidden sm:block" />Rules Engine</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5 hidden sm:block" />Alert Log</TabsTrigger>
        </TabsList>

        {/* ---- Tab: Guest Recognition Dashboard ---- */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {/* Today's Arrivals */}
          <Card className="border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LogIn className="h-5 w-5 text-emerald-600" />
                    Today&apos;s Arriving VIPs
                  </CardTitle>
                  <CardDescription>Guests checking in today requiring VIP recognition</CardDescription>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {todaysArrivals.length} arriving
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {todaysArrivals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <LogIn className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No VIP guests arriving today</p>
                </div>
              ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {todaysArrivals.map(guest => {
                  const config = TIER_CONFIG[guest.tier];
                  // L-43: Removed redundant isToday check — todaysArrivals is already filtered to today's check-ins
                  return (
                    <div
                      key={guest.id}
                      className={`rounded-lg border-2 p-4 cursor-pointer transition-shadow hover:shadow-md border-emerald-300 bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo}`}
                      onClick={() => handleOpenGuest(guest)}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className={`${config.iconBg} text-white font-bold`}>
                            {getInitials(guest.firstName, guest.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{guest.firstName} {guest.lastName}</p>
                            {getTierBadge(guest.tier)}
                          </div>
                          {guest.company && (
                            <p className="text-xs text-muted-foreground truncate">{guest.company}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            {guest.roomNumber && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> Room {guest.roomNumber}</span>}
                            {guest.checkOutDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {guest.checkOutDate}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>

                      {/* Quick preferences preview */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {guest.dietaryPreference && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Utensils className="h-2.5 w-2.5" /> {guest.dietaryPreference}
                          </Badge>
                        )}
                        {guest.pillowPreference && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Moon className="h-2.5 w-2.5" /> {guest.pillowPreference}
                          </Badge>
                        )}
                        {guest.allergies && guest.allergies !== 'None' && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-red-600 border-red-200">
                            <Pill className="h-2.5 w-2.5" /> {guest.allergies}
                          </Badge>
                        )}
                        {guest.specialRequests && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <MessageSquare className="h-2.5 w-2.5" /> Special requests
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>

          {/* All VIP Guests List */}
          <Card className="border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">All VIP Guests</CardTitle>
                  <CardDescription>Complete guest recognition list with preferences</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search guests..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 w-48"
                    />
                  </div>
                  <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as VipTier | 'all')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="bronze">Bronze</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Nights</TableHead>
                      <TableHead>Visits</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Preferences</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vipLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Loading VIP guests…
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredGuests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {vipGuests.length === 0
                            ? 'No VIP guests currently checked in'
                            : 'No guests match the current filter'}
                        </TableCell>
                      </TableRow>
                    ) : filteredGuests.map(guest => (
                      <TableRow key={guest.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenGuest(guest)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`${TIER_CONFIG[guest.tier].iconBg} text-white text-xs font-bold`}>
                                {getInitials(guest.firstName, guest.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                              <p className="text-xs text-muted-foreground">{guest.company || guest.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getTierBadge(guest.tier)}</TableCell>
                        <TableCell className="font-medium">${guest.totalSpent.toLocaleString()}</TableCell>
                        <TableCell>{guest.totalNights}</TableCell>
                        <TableCell>{guest.totalVisits}</TableCell>
                        <TableCell>
                          {guest.roomNumber ? (
                            <span className="text-sm">{guest.roomNumber} · {guest.roomType}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No stay</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {guest.dietaryPreference && (
                              <Badge variant="outline" className="text-[10px] gap-0.5">
                                <Utensils className="h-2.5 w-2.5" /> {guest.dietaryPreference}
                              </Badge>
                            )}
                            {guest.allergies && guest.allergies !== 'None' && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-red-600">
                                <Pill className="h-2.5 w-2.5" /> {guest.allergies}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: VIP Tier Configuration ---- */}
        <TabsContent value="tiers" className="mt-4 space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {(Object.values(TIER_CONFIG) as VipTierConfig[]).map(config => (
              <Card key={config.tier} className={`border-0 bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-full ${config.iconBg}`}>
                        {config.tier === 'platinum' ? <Crown className="h-6 w-6 text-white" /> :
                         config.tier === 'gold' ? <Star className="h-6 w-6 text-white" /> :
                         config.tier === 'silver' ? <Medal className="h-6 w-6 text-white" /> :
                         <Award className="h-6 w-6 text-white" />}
                      </div>
                      <div>
                        <CardTitle className={`text-lg ${config.color}`}>{config.label} VIP</CardTitle>
                        <CardDescription>{tierCounts[config.tier]} guests in this tier</CardDescription>
                      </div>
                    </div>
                    <Badge className={`${config.bgColor} ${config.color} text-sm`}>
                      {vipGuests.filter(g => g.tier === config.tier).length} active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Qualification Rules */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Qualification Requirements</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" /> Total Spend
                        </div>
                        <p className="font-bold text-sm mt-1">${config.minSpend.toLocaleString()}+</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Moon className="h-3.5 w-3.5" /> Nights Stayed
                        </div>
                        <p className="font-bold text-sm mt-1">{config.minNights}+</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Repeat className="h-3.5 w-3.5" /> Visits / Year
                        </div>
                        <p className="font-bold text-sm mt-1">{config.minVisits}+</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="h-3.5 w-3.5" /> Loyalty Points
                        </div>
                        <p className="font-bold text-sm mt-1">{config.minPoints.toLocaleString()}+</p>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Tier Benefits</h4>
                    <div className="space-y-2">
                      {config.benefits.map(benefit => (
                        <div key={benefit.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/40 dark:bg-black/10">
                          <div className="p-1.5 rounded bg-white/80 dark:bg-black/20 shrink-0 mt-0.5">
                            {benefit.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{benefit.name}</p>
                            <p className="text-xs text-muted-foreground">{benefit.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---- Tab: Recognition Rules Engine ---- */}
        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Recognition Rules Engine
              </CardTitle>
              <CardDescription>Configure automatic guest recognition triggers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map(rule => (
                  <div key={rule.id} className={`p-4 rounded-lg border ${rule.isActive ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${ALERT_TYPE_CONFIG[rule.alertType].color}`}>
                          {ALERT_TYPE_CONFIG[rule.alertType].icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rule.name}</p>
                            <Badge className={ALERT_TYPE_CONFIG[rule.alertType].color}>
                              {ALERT_TYPE_CONFIG[rule.alertType].label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{rule.description}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              <span>{rule.triggerCondition}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-2">
                              {rule.channels.map(ch => (
                                <Badge key={ch} variant="outline" className="text-[10px] gap-1">
                                  {NOTIFICATION_CHANNEL_CONFIG[ch].icon}
                                  {NOTIFICATION_CHANNEL_CONFIG[ch].label}
                                </Badge>
                              ))}
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-1">
                              <Filter className="h-3 w-3 text-muted-foreground" />
                              {rule.tierFilter.map(t => (
                                <Badge key={t} className={`${TIER_CONFIG[t].bgColor} ${TIER_CONFIG[t].color} text-[10px]`}>
                                  {TIER_CONFIG[t].label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleRule(rule.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notification Channels Overview */}
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="text-lg">Notification Channels</CardTitle>
              <CardDescription>How recognition alerts are delivered to staff</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                {(Object.entries(NOTIFICATION_CHANNEL_CONFIG) as [NotificationChannel, typeof NOTIFICATION_CHANNEL_CONFIG[NotificationChannel]][]).map(([key, config]) => {
                  const rulesUsingChannel = rules.filter(r => r.channels.includes(key) && r.isActive).length;
                  return (
                    <div key={key} className="p-4 rounded-lg border text-center">
                      <div className="p-3 rounded-full bg-muted inline-flex mb-3">
                        {React.cloneElement(config.icon as React.ReactElement, { className: 'h-6 w-6 text-muted-foreground' })}
                      </div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-2xl font-bold mt-1">{rulesUsingChannel}</p>
                      <p className="text-xs text-muted-foreground">active rules</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Tab: Alert History Log ---- */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Alert History Log
                  </CardTitle>
                  <CardDescription>All recognition alerts with staff actions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.success('Log exported to CSV')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Alert Type</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Action Taken</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertLog.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{entry.timestamp}</TableCell>
                        <TableCell className="font-medium">{entry.guestName}</TableCell>
                        <TableCell>{getTierBadge(entry.guestTier)}</TableCell>
                        <TableCell>
                          <Badge className={`${ALERT_TYPE_CONFIG[entry.alertType].color} gap-1 text-xs`}>
                            {ALERT_TYPE_CONFIG[entry.alertType].icon}
                            {ALERT_TYPE_CONFIG[entry.alertType].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs gap-1">
                            {NOTIFICATION_CHANNEL_CONFIG[entry.channel].icon}
                            {NOTIFICATION_CHANNEL_CONFIG[entry.channel].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate">{entry.message}</p>
                          {entry.acknowledgedBy && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Acknowledged by {entry.acknowledgedBy}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.actionTaken ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-xs">{entry.actionTaken}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Guest Detail Dialog */}
      <Dialog open={isGuestDialogOpen} onOpenChange={setIsGuestDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedGuest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className={`${TIER_CONFIG[selectedGuest.tier].iconBg} text-white text-xl font-bold`}>
                      {getInitials(selectedGuest.firstName, selectedGuest.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedGuest.firstName} {selectedGuest.lastName}
                      {getTierBadge(selectedGuest.tier)}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedGuest.company || selectedGuest.email}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Guest Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="font-bold">${selectedGuest.totalSpent.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Total Spent</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Moon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="font-bold">{selectedGuest.totalNights}</p>
                    <p className="text-[10px] text-muted-foreground">Nights</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Repeat className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="font-bold">{selectedGuest.totalVisits}</p>
                    <p className="text-[10px] text-muted-foreground">Visits</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Star className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="font-bold">{selectedGuest.loyaltyPoints.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Points</p>
                  </div>
                </div>

                {/* Know Before They Arrive */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-600" />
                    Know Before They Arrive
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedGuest.dietaryPreference && (
                      <div className="p-2.5 rounded-lg border text-sm">
                        <span className="text-muted-foreground text-xs">Dietary:</span>
                        <p className="font-medium">{selectedGuest.dietaryPreference}</p>
                      </div>
                    )}
                    {selectedGuest.pillowPreference && (
                      <div className="p-2.5 rounded-lg border text-sm">
                        <span className="text-muted-foreground text-xs">Pillow:</span>
                        <p className="font-medium">{selectedGuest.pillowPreference}</p>
                      </div>
                    )}
                    {selectedGuest.roomPreference && (
                      <div className="p-2.5 rounded-lg border text-sm">
                        <span className="text-muted-foreground text-xs">Room:</span>
                        <p className="font-medium">{selectedGuest.roomPreference}</p>
                      </div>
                    )}
                    {selectedGuest.allergies && (
                      <div className={`p-2.5 rounded-lg border text-sm ${selectedGuest.allergies !== 'None' ? 'border-red-200 bg-red-50 dark:bg-red-950' : ''}`}>
                        <span className="text-muted-foreground text-xs">Allergies:</span>
                        <p className={`font-medium ${selectedGuest.allergies !== 'None' ? 'text-red-600' : ''}`}>{selectedGuest.allergies}</p>
                      </div>
                    )}
                  </div>
                  {selectedGuest.specialRequests && (
                    <div className="p-2.5 rounded-lg border text-sm">
                      <span className="text-muted-foreground text-xs">Special Requests:</span>
                      <p className="font-medium">{selectedGuest.specialRequests}</p>
                    </div>
                  )}
                  {selectedGuest.tags && selectedGuest.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedGuest.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Previous Feedback */}
                {selectedGuest.previousFeedback && selectedGuest.previousFeedback.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Previous Stay Feedback</h4>
                    <div className="space-y-2">
                      {selectedGuest.previousFeedback.map((fb, i) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{fb.stay}</span>
                            {getRatingStars(fb.rating)}
                          </div>
                          <p className="text-sm">&ldquo;{fb.comment}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
