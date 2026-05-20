'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Star, Crown, Gift, TrendingUp, Users, Award, Zap,
  ChevronRight, Medal, Diamond, Circle, Plus, Minus,
  ArrowUpCircle, ArrowDownCircle, History, Coins, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  maxPoints: number;
  multiplier: number;
  benefits: string[];
  color: string;
  icon: React.ReactNode;
  memberCount: number;
}

interface LoyaltyStats {
  totalMembers: number;
  activeMembers: number;
  pointsEarnedThisMonth: number;
  pointsRedeemedThisMonth: number;
  averagePointsPerMember: number;
}

interface TopMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
}

interface PointTransaction {
  id: string;
  guestId: string;
  points: number;
  balance: number;
  type: string;
  source: string | null;
  description: string | null;
  createdAt: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    loyaltyTier: string;
    loyaltyPoints: number;
  };
}

interface PointsLedgerData {
  transactions: PointTransaction[];
  monthly: {
    earned: number;
    earnedCount: number;
    redeemed: number;
    redeemedCount: number;
  };
  summary: {
    totalEarned: number;
    totalRedeemed: number;
    currentBalance: number;
  } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const defaultTiers: LoyaltyTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 999,
    multiplier: 1,
    benefits: ['Earn 1 point per $1 spent', 'Birthday bonus', 'Member-only rates'],
    color: 'from-amber-600 to-amber-800',
    icon: <Medal className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Silver',
    minPoints: 1000,
    maxPoints: 4999,
    multiplier: 1.5,
    benefits: ['Earn 1.5 points per $1 spent', '10% bonus on stays', 'Early check-in', 'Free room upgrade when available'],
    color: 'from-gray-400 to-gray-600',
    icon: <Circle className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Gold',
    minPoints: 5000,
    maxPoints: 14999,
    multiplier: 2,
    benefits: ['Earn 2 points per $1 spent', '20% bonus on stays', 'Guaranteed late checkout', 'Welcome amenity', 'Priority reservations'],
    color: 'from-yellow-400 to-yellow-600',
    icon: <Star className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    maxPoints: 999999,
    multiplier: 3,
    benefits: ['Earn 3 points per $1 spent', '30% bonus on stays', 'Suite upgrades', 'Complimentary breakfast', 'Personal concierge', 'Free spa access'],
    color: 'from-purple-400 to-purple-600',
    icon: <Diamond className="h-5 w-5" />,
    memberCount: 0,
  },
];

const redemptionOptions = [
  { id: 'free_night', name: 'Free Night', points: 10000, icon: <Zap className="h-5 w-5" />, description: 'One free night stay' },
  { id: 'room_upgrade', name: 'Room Upgrade', points: 5000, icon: <Award className="h-5 w-5" />, description: 'Upgrade to next room category' },
  { id: 'spa_credit', name: 'Spa Credit', points: 3000, icon: <Crown className="h-5 w-5" />, description: 'Spa credit voucher' },
  { id: 'late_checkout', name: 'Late Checkout', points: 2000, icon: <History className="h-5 w-5" />, description: 'Guaranteed 2pm checkout' },
];

export default function LoyaltyPrograms() {
  const t = useTranslations('crm');
  const { formatCurrency } = useCurrency();
  const [tiers, setTiers] = useState<LoyaltyTier[]>(defaultTiers);
  const [stats, setStats] = useState<LoyaltyStats>({
    totalMembers: 0,
    activeMembers: 0,
    pointsEarnedThisMonth: 0,
    pointsRedeemedThisMonth: 0,
    averagePointsPerMember: 0,
  });
  const [topMembers, setTopMembers] = useState<TopMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Points Ledger state
  const [ledgerData, setLedgerData] = useState<PointsLedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');

  // Earn Points dialog state
  const [earnDialogOpen, setEarnDialogOpen] = useState(false);
  const [earnFormData, setEarnFormData] = useState({ guestId: '', points: '', description: '' });
  const [earnSubmitting, setEarnSubmitting] = useState(false);

  // Redeem Points dialog state
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemGuestId, setRedeemGuestId] = useState('');
  const [redeemGuestPoints, setRedeemGuestPoints] = useState(0);
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  useEffect(() => {
    fetchPointsLedger();
  }, [ledgerPage, selectedGuestId]);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);

      // Fetch guests for loyalty stats
      const guestsResponse = await fetch('/api/guests');
      const guestsData = await guestsResponse.json();

      if (guestsData.success) {
        const guests = guestsData.data || [];

        // Calculate stats
        const totalMembers = guests.length;
        const activeMembers = guests.filter((g: { totalStays: number }) => g.totalStays > 0).length;
        const totalPoints = guests.reduce((acc: number, g: { loyaltyPoints: number }) => acc + g.loyaltyPoints, 0);
        const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;

        setStats({
          totalMembers,
          activeMembers,
          pointsEarnedThisMonth: 0, // Will be fetched from ledger API
          pointsRedeemedThisMonth: 0, // Will be fetched from ledger API
          averagePointsPerMember: avgPoints,
        });

        // Calculate tier counts
        const tierCounts: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
        guests.forEach((g: { loyaltyTier: string }) => {
          const tier = g.loyaltyTier.toLowerCase();
          if (tierCounts[tier] !== undefined) tierCounts[tier]++;
        });

        setTiers(defaultTiers.map(tier => ({
          ...tier,
          memberCount: tierCounts[tier.name.toLowerCase()] || 0,
        })));

        // Get top members
        const sorted = [...guests]
          .sort((a: { loyaltyPoints: number }, b: { loyaltyPoints: number }) => b.loyaltyPoints - a.loyaltyPoints)
          .slice(0, 5);
        setTopMembers(sorted);
      }

      // Fetch monthly points stats from ledger API
      const ledgerResponse = await fetch('/api/loyalty/points');
      const ledgerJson = await ledgerResponse.json();
      if (ledgerJson.success) {
        setStats(prev => ({
          ...prev,
          pointsEarnedThisMonth: ledgerJson.data.monthly.earned || 0,
          pointsRedeemedThisMonth: ledgerJson.data.monthly.redeemed || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
      toast.error('Failed to fetch loyalty data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPointsLedger = async () => {
    try {
      setLedgerLoading(true);
      const params = new URLSearchParams({ page: String(ledgerPage) });
      if (selectedGuestId) params.append('guestId', selectedGuestId);

      const response = await fetch(`/api/loyalty/points?${params}`);
      const data = await response.json();

      if (data.success) {
        setLedgerData(data.data);
      }
    } catch (error) {
      console.error('Error fetching points ledger:', error);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleEarnPoints = async () => {
    if (!earnFormData.guestId || !earnFormData.points || Number(earnFormData.points) <= 0) {
      toast.error('Please select a guest and enter valid points');
      return;
    }

    try {
      setEarnSubmitting(true);
      const response = await fetch('/api/loyalty/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'earn',
          guestId: earnFormData.guestId,
          points: Number(earnFormData.points),
          description: earnFormData.description || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setEarnDialogOpen(false);
        setEarnFormData({ guestId: '', points: '', description: '' });
        fetchLoyaltyData();
        fetchPointsLedger();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      toast.error('Failed to earn points');
    } finally {
      setEarnSubmitting(false);
    }
  };

  const handleRedeemPoints = async (rewardId: string, points: number) => {
    try {
      setRedeemSubmitting(true);
      const response = await fetch('/api/loyalty/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'redeem',
          guestId: redeemGuestId,
          rewardId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setRedeemDialogOpen(false);
        fetchLoyaltyData();
        fetchPointsLedger();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      toast.error('Failed to redeem points');
    } finally {
      setRedeemSubmitting(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300',
      silver: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-800 dark:to-gray-700 dark:text-gray-300',
      gold: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 dark:from-yellow-900 dark:to-yellow-800 dark:text-yellow-300',
      platinum: 'bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 dark:from-violet-900 dark:to-violet-800 dark:text-violet-300',
      diamond: 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 dark:from-cyan-900 dark:to-cyan-800 dark:text-cyan-300',
    };
    return colors[tier.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Loyalty Programs</h1>
          <p className="text-muted-foreground">
            Manage guest loyalty tiers, rewards, and benefits
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEarnDialogOpen(true)} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            <Plus className="h-4 w-4 mr-2" />
            Earn Points
          </Button>
          <Button onClick={() => {
            if (!topMembers.length) { toast.error('No members available'); return; }
            setRedeemGuestId(topMembers[0].id);
            setRedeemGuestPoints(topMembers[0].loyaltyPoints);
            setRedeemDialogOpen(true);
          }} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md">
            <Gift className="h-4 w-4 mr-2" />
            Redeem Points
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{stats.totalMembers.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Points Earned (Month)</p>
                <p className="text-2xl font-bold">{stats.pointsEarnedThisMonth.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Points Redeemed (Month)</p>
                <p className="text-2xl font-bold">{stats.pointsRedeemedThisMonth.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-cyan-100 dark:bg-cyan-900 p-3">
                <Gift className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Points/Member</p>
                <p className="text-2xl font-bold">{stats.averagePointsPerMember.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-rose-100 dark:bg-rose-900 p-3">
                <Zap className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tiers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tiers">Tier Levels</TabsTrigger>
          <TabsTrigger value="ledger">Points Ledger</TabsTrigger>
          <TabsTrigger value="redemptions">Redemption Options</TabsTrigger>
          <TabsTrigger value="leaderboard">Top Members</TabsTrigger>
        </TabsList>

        {/* Tier Levels Tab */}
        <TabsContent value="tiers" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <Card key={tier.name} className="relative overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tier.color}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-full bg-gradient-to-r ${tier.color} p-2 text-white`}>
                        {tier.icon}
                      </div>
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 dark:from-violet-900 dark:to-violet-800 dark:text-violet-300">{tier.memberCount} members</Badge>
                  </div>
                  <CardDescription>
                    {tier.minPoints.toLocaleString()} - {tier.maxPoints === 999999 ? '∞' : tier.maxPoints.toLocaleString()} points
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{tier.multiplier}x points multiplier</span>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Benefits:</p>
                    <ul className="space-y-1">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tier Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Member Distribution</CardTitle>
              <CardDescription>Current breakdown of members across loyalty tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <div key={tier.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{tier.name}</span>
                      <span>{tier.memberCount} members ({stats.totalMembers > 0 ? Math.round((tier.memberCount / stats.totalMembers) * 100) : 0}%)</span>
                    </div>
                    <Progress
                      value={stats.totalMembers > 0 ? (tier.memberCount / stats.totalMembers) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Ledger Tab */}
        <TabsContent value="ledger" className="space-y-6">
          {/* Summary Cards */}
          {ledgerData?.summary && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                      <Coins className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className="text-xl font-bold">{ledgerData.summary.currentBalance.toLocaleString()} pts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-2">
                      <ArrowUpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Earned This Month</p>
                      <p className="text-xl font-bold">+{ledgerData.monthly.earned.toLocaleString()} pts</p>
                      <p className="text-xs text-muted-foreground">{ledgerData.monthly.earnedCount} transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-cyan-100 dark:bg-cyan-900 p-2">
                      <ArrowDownCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Redeemed This Month</p>
                      <p className="text-xl font-bold">-{ledgerData.monthly.redeemed.toLocaleString()} pts</p>
                      <p className="text-xs text-muted-foreground">{ledgerData.monthly.redeemedCount} transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>All points earn and redemption activity</CardDescription>
                </div>
                {topMembers.length > 0 && (
                  <select
                    value={selectedGuestId}
                    onChange={(e) => { setSelectedGuestId(e.target.value); setLedgerPage(1); }}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">All Guests</option>
                    {topMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.loyaltyPoints.toLocaleString()} pts)</option>
                    ))}
                  </select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {ledgerLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : !ledgerData?.transactions.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
                  <p className="text-sm">Points transactions will appear here when points are earned or redeemed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Date</th>
                          <th className="pb-2 font-medium text-muted-foreground">Guest</th>
                          <th className="pb-2 font-medium text-muted-foreground">Type</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Points</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Balance</th>
                          <th className="pb-2 font-medium text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {ledgerData.transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 text-muted-foreground whitespace-nowrap">
                              {formatDate(tx.createdAt)}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                  {tx.guest?.firstName?.[0]}{tx.guest?.lastName?.[0]}
                                </div>
                                <span className="font-medium whitespace-nowrap">
                                  {tx.guest?.firstName} {tx.guest?.lastName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-xs',
                                  tx.type === 'earn' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                                  tx.type === 'redeem' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                )}
                              >
                                {tx.type === 'earn' ? '↑ Earn' : tx.type === 'redeem' ? '↓ Redeem' : tx.type}
                              </Badge>
                            </td>
                            <td className={cn(
                              'py-3 text-right font-semibold whitespace-nowrap',
                              tx.points > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            )}>
                              {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-medium whitespace-nowrap">
                              {tx.balance.toLocaleString()}
                            </td>
                            <td className="py-3 text-muted-foreground max-w-[200px] truncate">
                              {tx.description || tx.source || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {ledgerData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {ledgerData.pagination.page} of {ledgerData.pagination.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ledgerPage <= 1}
                          onClick={() => setLedgerPage(p => p - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ledgerPage >= ledgerData.pagination.totalPages}
                          onClick={() => setLedgerPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redemption Options Tab */}
        <TabsContent value="redemptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Points Redemption Options</CardTitle>
              <CardDescription>Available rewards that guests can redeem with their points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {redemptionOptions.map((option) => (
                  <Card key={option.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 border-2 hover:border-emerald-200 dark:hover:border-emerald-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 p-2 text-emerald-600 dark:text-emerald-400">
                          {option.icon}
                        </div>
                        <Badge className="bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300">
                          {option.points.toLocaleString()} pts
                        </Badge>
                      </div>
                      <h4 className="font-semibold mb-1">{option.name}</h4>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Points Value Calculator */}
          <Card>
            <CardHeader>
              <CardTitle>Points Value</CardTitle>
              <CardDescription>Estimated value of loyalty points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(0.01)}</p>
                  <p className="text-sm text-muted-foreground">Per Point Value</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">100</p>
                  <p className="text-sm text-muted-foreground">Points per unit currency spent</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">10,000</p>
                  <p className="text-sm text-muted-foreground">Points for Free Night</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Members Tab */}
        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Loyalty Members</CardTitle>
              <CardDescription>Highest point earners across all tiers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : topMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="space-y-4">
                  {topMembers.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-white ${
                          index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{member.firstName} {member.lastName}</p>
                          <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn(getTierColor(member.loyaltyTier), 'shadow-sm')}>
                          <Crown className="h-3 w-3 mr-1" />
                          {member.loyaltyTier}
                        </Badge>
                        <div className="text-right hidden sm:block">
                          <p className="font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">{member.loyaltyPoints.toLocaleString()} pts</p>
                          <p className="text-sm text-muted-foreground">{member.totalStays} stays</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRedeemGuestId(member.id);
                            setRedeemGuestPoints(member.loyaltyPoints);
                            setRedeemDialogOpen(true);
                          }}
                          className="text-cyan-600 hover:text-cyan-700"
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          Redeem
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Earn Points Dialog */}
      <Dialog open={earnDialogOpen} onOpenChange={setEarnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Earn Points</DialogTitle>
            <DialogDescription>
              Award loyalty points to a guest. Points are multiplied by their tier level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Guest</label>
              <select
                value={earnFormData.guestId}
                onChange={(e) => setEarnFormData(prev => ({ ...prev, guestId: e.target.value }))}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Select a guest</option>
                {topMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.loyaltyTier} - {m.loyaltyPoints.toLocaleString()} pts)</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Base Points</label>
              <Input
                type="number"
                min="1"
                value={earnFormData.points}
                onChange={(e) => setEarnFormData(prev => ({ ...prev, points: e.target.value }))}
                placeholder="Enter base points"
              />
              {earnFormData.guestId && earnFormData.points && Number(earnFormData.points) > 0 && (() => {
                const guest = topMembers.find(m => m.id === earnFormData.guestId);
                const multipliers: Record<string, number> = { bronze: 1, silver: 1.5, gold: 2, platinum: 3 };
                const mult = multipliers[guest?.loyaltyTier?.toLowerCase() || 'bronze'] || 1;
                const total = Math.round(Number(earnFormData.points) * mult);
                return (
                  <p className="text-xs text-muted-foreground">
                    {guest?.loyaltyTier} tier: {mult}x multiplier = <span className="font-semibold text-emerald-600">{total} pts</span>
                  </p>
                );
              })()}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={earnFormData.description}
                onChange={(e) => setEarnFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Points for stay #12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEarnPoints} disabled={earnSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {earnSubmitting ? 'Earning...' : 'Earn Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Points Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Redeem Points</DialogTitle>
            <DialogDescription>
              Current balance: <span className="font-bold text-emerald-600">{redeemGuestPoints.toLocaleString()} pts</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {redemptionOptions.map((reward) => {
                const canAfford = redeemGuestPoints >= reward.points;
                return (
                  <button
                    key={reward.id}
                    disabled={!canAfford || redeemSubmitting}
                    onClick={() => handleRedeemPoints(reward.id, reward.points)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      canAfford
                        ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-950 cursor-pointer'
                        : 'border-gray-200 opacity-50 cursor-not-allowed dark:border-gray-700'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 p-1.5 text-emerald-600 dark:text-emerald-400">
                        {reward.icon}
                      </div>
                      <span className="font-semibold text-sm">{reward.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{reward.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs">
                        {reward.points.toLocaleString()} pts
                      </Badge>
                      {!canAfford && (
                        <span className="text-xs text-red-500">Not enough points</span>
                      )}
                      {canAfford && (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
