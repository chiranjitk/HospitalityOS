'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageSquare,
  Phone,
  Mail,
  Clock,
  Star,
  Send,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Sparkles,
  UtensilsCrossed,
  Car,
  Heart,
  Shirt,
  Bell,
  Moon,
  Shield,
  User,
  Award,
  Gift,
  TrendingUp,
  Zap,
  Bot,
  Reply,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  ChevronRight,
  Globe,
  Calendar,
  Target,
  Crown,
  Coffee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  guestName: string;
  room: string;
  channel: 'chat' | 'sms' | 'email' | 'whatsapp';
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  status: 'open' | 'waiting' | 'resolved';
  messages: { id: string; from: 'guest' | 'staff' | 'bot'; text: string; time: string }[];
}

interface ServiceRequest {
  id: string;
  guestName: string;
  room: string;
  type: string;
  priority: 'emergency' | 'high' | 'medium' | 'low';
  status: 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  description: string;
  assignedTo: string | null;
  createdAt: string;
  slaMinutes: number;
  elapsedMinutes: number;
  rating: number | null;
  satisfactionFeedback: string | null;
}

interface Review {
  id: string;
  guestName: string;
  source: 'google' | 'tripadvisor' | 'booking.com' | 'direct';
  rating: number;
  text: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  responded: boolean;
  responseText: string | null;
  responseSlaHours: number;
  elapsedHours: number;
}

interface LoyaltyGuest {
  id: string;
  name: string;
  email: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points: number;
  totalSpent: number;
  staysCount: number;
  pointsEarned: number;
  pointsRedeemed: number;
  nextTier: string;
  nextTierPoints: number;
  joinedAt: string;
  upcomingOccasions: { type: string; date: string }[];
}

interface PreferenceCard {
  guestName: string;
  room: string;
  preferences: {
    category: string;
    value: string;
  }[];
  stayPatterns: string[];
  upsells: string[];
  specialOccasions: { type: string; date: string }[];
}

interface RewardItem {
  id: string;
  name: string;
  points: number;
  category: string;
  description?: string;
  isAvailable?: boolean;
}

// quickReplies: UI configuration constant (no API endpoint exists)
const quickReplies = [
  'Thank you for reaching out! Let me check on that for you.',
  'We\'ll have someone attend to that right away.',
  'Is there anything else I can help you with?',
  'Your request has been forwarded to the relevant department.',
  'We apologize for the inconvenience. A team member will be with you shortly.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const channelIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  whatsapp: <Phone className="h-4 w-4" />,
};

const channelColors: Record<string, string> = {
  chat: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  sms: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  email: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  whatsapp: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const priorityConfig: Record<string, { color: string; bg: string; sla: number }> = {
  emergency: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500', sla: 10 },
  high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500', sla: 15 },
  medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500', sla: 30 },
  low: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/10 border-gray-500', sla: 60 },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-slate-500' },
  assigned: { label: 'Assigned', color: 'bg-cyan-500' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500' },
  resolved: { label: 'Resolved', color: 'bg-emerald-500' },
  closed: { label: 'Closed', color: 'bg-gray-500' },
};

const sourceColors: Record<string, string> = {
  google: 'bg-red-500/10 text-red-600 dark:text-red-400',
  tripadvisor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'booking.com': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  direct: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

const tierConfig: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  bronze: { color: 'text-amber-700 dark:text-amber-500', icon: <Shield className="h-4 w-4" />, bg: 'from-amber-600 to-amber-800' },
  silver: { color: 'text-gray-500 dark:text-gray-300', icon: <Shield className="h-4 w-4" />, bg: 'from-gray-400 to-gray-600' },
  gold: { color: 'text-yellow-500', icon: <Crown className="h-4 w-4" />, bg: 'from-yellow-500 to-amber-500' },
  platinum: { color: 'text-cyan-500', icon: <Crown className="h-4 w-4" />, bg: 'from-cyan-500 to-teal-500' },
  diamond: { color: 'text-violet-500', icon: <Award className="h-4 w-4" />, bg: 'from-violet-500 to-purple-600' },
};

const requestTypeIcons: Record<string, React.ReactNode> = {
  'Housekeeping': <Sparkles className="h-4 w-4" />,
  'Maintenance': <Wrench className="h-4 w-4" />,
  'F&B': <UtensilsCrossed className="h-4 w-4" />,
  'Transport': <Car className="h-4 w-4" />,
  'Spa': <Heart className="h-4 w-4" />,
  'Laundry': <Shirt className="h-4 w-4" />,
  'Concierge': <Bell className="h-4 w-4" />,
  'Wake-up Call': <Bell className="h-4 w-4" />,
  'Do Not Disturb': <Moon className="h-4 w-4" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuestHub() {
  const [activeTab, setActiveTab] = useState('communication');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [requestFilter, setRequestFilter] = useState<string>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>('all');
  const [conversationFilter, setConversationFilter] = useState<string>('all');
  const [selectedLoyaltyGuest, setSelectedLoyaltyGuest] = useState<LoyaltyGuest | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<PreferenceCard | null>(null);
  const [autoResponseConfig, setAutoResponseConfig] = useState({
    enabled: true,
    greetingDelay: 30,
    awayMessage: 'Thanks for reaching out! A team member will respond shortly.',
  });
  const [showAutoResponseDialog, setShowAutoResponseDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── API Data State ─────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loyaltyGuests, setLoyaltyGuests] = useState<LoyaltyGuest[]>([]);
  const [preferenceCards, setPreferenceCards] = useState<PreferenceCard[]>([]);
  const [redemptionCatalog, setRedemptionCatalog] = useState<RewardItem[]>([]);
  const [reviewTrendData, setReviewTrendData] = useState<{ period: string; rating: number; reviews: number }[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Fetch conversation messages when a conversation is selected
  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      if (!selectedConversation || selectedConversation.messages.length > 0) return;
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/chat-conversations/${selectedConversation.id}/messages?limit=50`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const msgs = json.data.map((m: Record<string, unknown>) => ({
              id: m.id,
              from: m.senderType === 'guest' ? 'guest' : m.senderType === 'bot' ? 'bot' : 'staff',
              text: m.content || '',
              time: m.sentAt ? new Date(m.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
            }));
            setConversations(prev =>
              prev.map(c =>
                c.id === selectedConversation.id ? { ...c, messages: msgs } : c
              )
            );
          }
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }
    loadMessages();
    return () => { cancelled = true; };
  }, [selectedConversation?.id]);

  // Fetch all dashboard data from APIs
  useEffect(() => {
    async function fetchAllData() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [convRes, srRes, revRes, guestsRes, rewardsRes] = await Promise.allSettled([
          fetch('/api/chat-conversations?limit=50'),
          fetch('/api/service-requests?limit=50'),
          fetch('/api/crm/reviews?limit=50'),
          fetch('/api/guests?limit=50'),
          fetch('/api/loyalty/rewards'),
        ]);

        // Parse conversations
        if (convRes.status === 'fulfilled' && convRes.value.ok) {
          const convJson = await convRes.value.json();
          if (convJson.success && Array.isArray(convJson.data)) {
            const mapped: Conversation[] = convJson.data.map((c: Record<string, unknown>) => ({
              id: c.id,
              guestName: c.guest
                ? `${c.guest.firstName || ''} ${c.guest.lastName || ''}`.trim() || 'Guest'
                : 'Guest',
              room: c.booking?.room?.number || '',
              channel: (c.channel || 'chat') as Conversation['channel'],
              lastMessage: c.lastMessage || c.messages?.[0]?.content || '',
              lastMessageAt: c.lastMessageAt
                ? new Date(c.lastMessageAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '',
              unread: c.unreadCount || 0,
              status: (c.status || 'open') as Conversation['status'],
              messages: [],
            }));
            setConversations(mapped);
          }
        }

        // Parse service requests
        if (srRes.status === 'fulfilled' && srRes.value.ok) {
          const srJson = await srRes.value.json();
          if (srJson.success && Array.isArray(srJson.data)) {
            const mapped: ServiceRequest[] = srJson.data.map((r: Record<string, unknown>) => {
              const elapsed = r.requestedAt
                ? Math.round((Date.now() - new Date(r.requestedAt).getTime()) / 60000)
                : 0;
              return {
                id: r.id,
                guestName: r.guestId || 'Guest',
                room: r.roomId || '',
                type: r.type || r.category || 'General',
                priority: (r.priority || 'medium') as ServiceRequest['priority'],
                status: (r.status || 'new') as ServiceRequest['status'],
                description: r.description || r.subject || '',
                assignedTo: r.assignee
                  ? `${r.assignee.firstName || ''} ${r.assignee.lastName || ''}`.trim() || null
                  : null,
                createdAt: r.requestedAt
                  ? new Date(r.requestedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '',
                slaMinutes: r.priority === 'emergency' ? 10 : r.priority === 'high' ? 15 : r.priority === 'low' ? 60 : 30,
                elapsedMinutes: elapsed,
                rating: r.rating || null,
                satisfactionFeedback: r.feedback || null,
              };
            });
            setServiceRequests(mapped);
          }
        }

        // Parse reviews and build review trend data
        if (revRes.status === 'fulfilled' && revRes.value.ok) {
          const revJson = await revRes.value.json();
          if (revJson.success && Array.isArray(revJson.data?.reviews)) {
            const mapped: Review[] = revJson.data.reviews.map((r: Record<string, unknown>) => {
              const sentiment = r.sentimentLabel || (r.overallRating >= 4 ? 'positive' : r.overallRating >= 3 ? 'neutral' : 'negative');
              return {
                id: r.id,
                guestName: r.guest
                  ? `${r.guest.firstName || ''} ${r.guest.lastName || ''}`.trim() || 'Guest'
                  : 'Guest',
                source: (r.source === 'booking_com' ? 'booking.com' : r.source || 'direct') as Review['source'],
                rating: r.overallRating || 0,
                text: r.comment || r.title || '',
                date: r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
                sentiment: sentiment as Review['sentiment'],
                responded: !!r.responseText,
                responseText: r.responseText || null,
                responseSlaHours: 48,
                elapsedHours: r.respondedAt ? Math.round((Date.now() - new Date(r.respondedAt).getTime()) / 3600000) : 0,
              };
            });
            setReviews(mapped);

            // Derive review trend data from reviews by grouping into weekly buckets
            if (mapped.length > 0) {
              const sortedByDate = [...mapped].sort((a, b) => {
                const da = a.date ? new Date(a.date).getTime() : 0;
                const db2 = b.date ? new Date(b.date).getTime() : 0;
                return da - db2;
              });
              const weekBuckets: Map<string, { ratings: number[]; count: number }> = new Map();
              sortedByDate.forEach((r) => {
                const d = new Date(r.date).getTime();
                if (isNaN(d)) return;
                const startOfWeek = new Date(d);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                const key = startOfWeek.toISOString().split('T')[0];
                const bucket = weekBuckets.get(key) || { ratings: [], count: 0 };
                bucket.ratings.push(r.rating);
                bucket.count++;
                weekBuckets.set(key, bucket);
              });
              const trend = Array.from(weekBuckets.entries()).slice(-12).map(([week, data], i) => ({
                period: `Week ${i + 1}`,
                rating: Math.round((data.ratings.reduce((s, r) => s + r, 0) / data.ratings.length) * 10) / 10,
                reviews: data.count,
              }));
              setReviewTrendData(trend);
            }
          }
        }

        // Parse guests for loyalty members and preference cards
        if (guestsRes.status === 'fulfilled' && guestsRes.value.ok) {
          const guestsJson = await guestsRes.value.json();
          if (guestsJson.success && Array.isArray(guestsJson.data)) {
            const allGuests = guestsJson.data as Record<string, unknown>[];

            // Build loyalty guest list from guests with loyalty data
            const tierOrder = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];
            const loyaltyMapped: LoyaltyGuest[] = allGuests
              .filter((g) => g.loyaltyTier && g.loyaltyPoints > 0)
              .sort((a, b) => {
                const aIdx = tierOrder.indexOf(a.loyaltyTier as string);
                const bIdx = tierOrder.indexOf(b.loyaltyTier as string);
                return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
              })
              .map((g) => {
                const currentTierIdx = tierOrder.indexOf(g.loyaltyTier as string);
                const nextTierName = currentTierIdx > 0 ? tierOrder[currentTierIdx - 1] : null;
                const tierThresholds: Record<string, number> = { bronze: 0, silver: 1000, gold: 5000, platinum: 15000, diamond: 50000 };
                return {
                  id: g.id,
                  name: `${g.firstName || ''} ${g.lastName || ''}`.trim() || 'Guest',
                  email: g.email || '',
                  tier: (g.loyaltyTier || 'bronze') as LoyaltyGuest['tier'],
                  points: g.loyaltyPoints || 0,
                  totalSpent: g.totalSpent || 0,
                  staysCount: g.totalStays || g.totalBookings || 0,
                  pointsEarned: Math.round((g.loyaltyPoints || 0) * 0.6),
                  pointsRedeemed: Math.round((g.loyaltyPoints || 0) * 0.25),
                  nextTier: nextTierName
                    ? nextTierName.charAt(0).toUpperCase() + nextTierName.slice(1)
                    : g.loyaltyTier
                      ? g.loyaltyTier.charAt(0).toUpperCase() + g.loyaltyTier.slice(1)
                      : 'Bronze',
                  nextTierPoints: nextTierName ? tierThresholds[nextTierName] || g.loyaltyPoints || 1 : g.loyaltyPoints || 1,
                  joinedAt: g.createdAt ? new Date(g.createdAt as string).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '',
                  upcomingOccasions: [],
                };
              });
            setLoyaltyGuests(loyaltyMapped);

            // Build preference cards from guests with preferences
            const prefCards: PreferenceCard[] = allGuests
              .filter((g) => {
                const prefs = g.preferences;
                return prefs && typeof prefs === 'object' && Object.keys(prefs as object).length > 0;
              })
              .slice(0, 12)
              .map((g) => {
                const prefs = g.preferences as Record<string, string> | null;
                const prefArray = prefs
                  ? Object.entries(prefs).map(([category, value]) => ({ category: category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value }))
                  : [];
                return {
                  guestName: `${g.firstName || ''} ${g.lastName || ''}`.trim() || 'Guest',
                  room: g.activeBooking?.roomNumber || '',
                  preferences: prefArray.length > 0 ? prefArray.slice(0, 6) : [{ category: 'Preferences', value: 'Configured' }],
                  stayPatterns: (g.tags && Array.isArray(g.tags) ? (g.tags as string[]) : []).slice(0, 4),
                  upsells: [],
                  specialOccasions: [],
                };
              });
            setPreferenceCards(prefCards);
          }
        }

        // Parse redemption catalog from loyalty rewards
        if (rewardsRes.status === 'fulfilled' && rewardsRes.value.ok) {
          const rewardsJson = await rewardsRes.value.json();
          if (rewardsJson.success && Array.isArray(rewardsJson.data)) {
            const mapped: RewardItem[] = rewardsJson.data.map((r: Record<string, unknown>) => ({
              id: r.id,
              name: r.name || 'Reward',
              points: r.pointsCost || 0,
              category: r.category || 'General',
              description: r.description || undefined,
              isAvailable: r.isAvailable !== false,
            }));
            setRedemptionCatalog(mapped);
          }
        }
      } catch (err) {
        console.error('Error fetching guest hub data:', err);
        setDataError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setDataLoading(false);
      }
    }
    fetchAllData();
  }, []);

  // ─── Computed ──────────────────────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (conversationFilter === 'unread') return c.unread > 0;
      if (conversationFilter === 'open') return c.status === 'open';
      if (conversationFilter === 'waiting') return c.status === 'waiting';
      return true;
    }).filter(c =>
      !searchQuery || c.guestName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversationFilter, searchQuery, conversations]);

  const filteredRequests = useMemo(() => {
    return serviceRequests.filter(r => {
      if (requestFilter !== 'all' && r.status !== requestFilter) return false;
      if (requestTypeFilter !== 'all' && r.type !== requestTypeFilter) return false;
      return true;
    });
  }, [requestFilter, requestTypeFilter, serviceRequests]);

  const sentimentStats = useMemo(() => {
    const total = reviews.length;
    const positive = reviews.filter(r => r.sentiment === 'positive').length;
    const neutral = reviews.filter(r => r.sentiment === 'neutral').length;
    const negative = reviews.filter(r => r.sentiment === 'negative').length;
    const avgRating = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { total, positive, neutral, negative, avgRating };
  }, [reviews]);

  const unrespondedReviews = reviews.filter(r => !r.responded);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground">{dataError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            Guest Experience Hub
          </h2>
          <p className="text-muted-foreground">Unified guest engagement and personalization dashboard</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {conversations.length} Conversations
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            {serviceRequests.filter(r => r.status === 'new' || r.status === 'assigned').length} Open Requests
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="communication" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Communication</span>
          </TabsTrigger>
          <TabsTrigger value="service-requests" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Service Requests</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback Hub</span>
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-1.5">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Loyalty</span>
          </TabsTrigger>
          <TabsTrigger value="personalization" className="gap-1.5">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Personalization</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Communication Center ───────────────────────────────────────── */}
        <TabsContent value="communication" className="space-y-4">
          {/* Quick Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{conversations.filter(c => c.status === 'open').length}</div>
                  <div className="text-xs text-muted-foreground">Open</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{conversations.filter(c => c.unread > 0).length}</div>
                  <div className="text-xs text-muted-foreground">Unread</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-cyan-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{conversations.filter(c => c.status === 'resolved').length}</div>
                  <div className="text-xs text-muted-foreground">Resolved Today</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-violet-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Bot className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">78%</div>
                  <div className="text-xs text-muted-foreground">Bot Resolution</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters + Auto-Response */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={conversationFilter} onValueChange={setConversationFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conversations</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="open">Open Only</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowAutoResponseDialog(true)}>
              <Bot className="h-4 w-4 mr-2" />
              Auto-Response
            </Button>
          </div>

          {/* Conversation List + Detail */}
          <div className="grid gap-4 md:grid-cols-5">
            {/* Conversation List */}
            <Card className="md:col-span-2">
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <div className="divide-y">
                    {filteredConversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">No conversations found</p>
                      </div>
                    ) : filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={cn(
                          'w-full text-left p-4 hover:bg-muted/50 transition-colors',
                          selectedConversation?.id === conv.id && 'bg-muted'
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {conv.guestName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{conv.guestName}</p>
                              <p className="text-xs text-muted-foreground">Room {conv.room}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px]', channelColors[conv.channel])}>
                            {channelIcons[conv.channel]}
                            <span className="ml-1 capitalize">{conv.channel}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-2">{conv.lastMessage}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">{conv.lastMessageAt}</span>
                          {conv.unread > 0 && (
                            <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary">
                              {conv.unread}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Conversation Detail */}
            <Card className="md:col-span-3">
              {selectedConversation ? (
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedConversation.guestName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{selectedConversation.guestName}</CardTitle>
                        <CardDescription>Room {selectedConversation.room} &bull; {selectedConversation.channel}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={selectedConversation.status === 'open' ? 'default' : 'secondary'}
                      className={cn(selectedConversation.status === 'open' ? 'bg-emerald-500' : '')}
                    >
                      {selectedConversation.status}
                    </Badge>
                  </div>
                </CardHeader>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Select a conversation to view details</p>
                  </div>
                </div>
              )}
              {selectedConversation && (
                <CardContent className="p-0">
                  <ScrollArea className="h-[360px] px-4">
                    <div className="space-y-4 py-4">
                      {messagesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : selectedConversation.messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-sm">No messages yet. Start the conversation!</p>
                        </div>
                      ) : selectedConversation.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex gap-2',
                            msg.from === 'guest' ? 'justify-start' : 'justify-end'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                              msg.from === 'guest'
                                ? 'bg-muted'
                                : msg.from === 'bot'
                                  ? 'bg-violet-500/10 text-violet-900 dark:text-violet-100'
                                  : 'bg-primary text-primary-foreground'
                            )}
                          >
                            {msg.from === 'bot' && (
                              <div className="flex items-center gap-1 text-xs font-medium mb-1 text-violet-600 dark:text-violet-400">
                                <Bot className="h-3 w-3" /> Auto-reply
                              </div>
                            )}
                            <p>{msg.text}</p>
                            <p className={cn(
                              'text-[10px] mt-1',
                              msg.from === 'guest' ? 'text-muted-foreground' : 'opacity-70'
                            )}>
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {/* Quick Reply Templates */}
                  <div className="border-t p-3">
                    <div className="flex flex-wrap gap-1 mb-3">
                      {quickReplies.slice(0, 3).map((reply, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toast.success('Quick reply sent!')}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          {reply.length > 40 ? reply.slice(0, 40) + '...' : reply}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Type your message..." className="flex-1" />
                      <Button size="sm" onClick={() => toast.success('Message sent!')}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* SLA Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Response Time SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {[
                  { channel: 'Chat', target: '< 2 min', current: '1.5 min', met: true },
                  { channel: 'WhatsApp', target: '< 5 min', current: '3.2 min', met: true },
                  { channel: 'SMS', target: '< 3 min', current: '4.1 min', met: false },
                  { channel: 'Email', target: '< 30 min', current: '22 min', met: true },
                ].map((sla) => (
                  <div key={sla.channel} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{sla.channel}</span>
                      {sla.met ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>Target: {sla.target}</div>
                      <div className={sla.met ? 'text-emerald-600' : 'text-amber-600'}>
                        Current: {sla.current}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Service Request Management ─────────────────────────────────── */}
        <TabsContent value="service-requests" className="space-y-4">
          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            {[
              { label: 'New', count: serviceRequests.filter(r => r.status === 'new').length, color: 'text-slate-500', bg: 'bg-slate-500/10' },
              { label: 'Assigned', count: serviceRequests.filter(r => r.status === 'assigned').length, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
              { label: 'In Progress', count: serviceRequests.filter(r => r.status === 'in_progress').length, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { label: 'Resolved', count: serviceRequests.filter(r => r.status === 'resolved').length, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'Emergency', count: serviceRequests.filter(r => r.priority === 'emergency').length, color: 'text-red-500', bg: 'bg-red-500/10' },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', s.bg)}>
                    <div className={cn('text-xl font-bold', s.color)}>{s.count}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={requestFilter} onValueChange={setRequestFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={requestTypeFilter} onValueChange={setRequestTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.keys(requestTypeIcons).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Requests Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">SLA</TableHead>
                      <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No service requests found</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredRequests.map((req) => {
                      const slaPercent = Math.min((req.elapsedMinutes / req.slaMinutes) * 100, 100);
                      const slaBreached = req.elapsedMinutes > req.slaMinutes;
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-xs">{req.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{req.guestName}</p>
                              <p className="text-xs text-muted-foreground">Room {req.room}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              {requestTypeIcons[req.type] || <MessageSquare className="h-4 w-4" />}
                              <span className="text-sm">{req.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs capitalize border-2', priorityConfig[req.priority].bg, priorityConfig[req.priority].color)}>
                              {req.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-white text-xs', statusConfig[req.status]?.color)}>
                              {statusConfig[req.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="w-24">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={slaBreached ? 'text-red-500 font-medium' : ''}>{req.elapsedMinutes}m</span>
                                <span>{req.slaMinutes}m</span>
                              </div>
                              <Progress value={slaPercent} className={cn('h-2', slaBreached && '[&>div]:bg-red-500')} />
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {req.assignedTo || <span className="text-muted-foreground text-xs">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                              View
                            </Button>
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

        {/* ─── Guest Feedback Hub ─────────────────────────────────────────── */}
        <TabsContent value="feedback" className="space-y-4">
          {/* Sentiment Summary */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{sentimentStats.avgRating.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Avg Rating</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{sentimentStats.positive}</div>
                  <div className="text-xs text-muted-foreground">Positive</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-400">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-400/10">
                  <MinusCircle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{sentimentStats.neutral}</div>
                  <div className="text-xs text-muted-foreground">Neutral</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{sentimentStats.negative}</div>
                  <div className="text-xs text-muted-foreground">Negative</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Review Trend (12 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {reviewTrendData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Not enough review data for trend chart</p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reviewTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis domain={[3, 5]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line type="monotone" dataKey="rating" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reviews Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Reviews ({reviews.length})</CardTitle>
              <CardDescription>{unrespondedReviews.length} reviews awaiting response</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="hidden md:table-cell">Sentiment</TableHead>
                      <TableHead className="hidden lg:table-cell">SLA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No reviews yet</p>
                        </TableCell>
                      </TableRow>
                    ) : reviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{review.guestName}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{review.text}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs capitalize', sourceColors[review.source])}>
                            <Globe className="h-3 w-3 mr-1" />
                            {review.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className={cn('h-3 w-3', review.rating >= 4 ? 'text-amber-500 fill-amber-500' : review.rating === 3 ? 'text-amber-400 fill-amber-400' : 'text-red-500 fill-red-500')} />
                            <span className="text-sm font-medium">{review.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={cn(
                            'text-xs capitalize',
                            review.sentiment === 'positive' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            review.sentiment === 'neutral' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                            review.sentiment === 'negative' && 'bg-red-500/10 text-red-600 border-red-500/30',
                          )}>
                            {review.sentiment}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-xs">
                            <span className={review.elapsedHours > review.responseSlaHours ? 'text-red-500 font-medium' : ''}>
                              {review.elapsedHours}h / {review.responseSlaHours}h
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {review.responded ? (
                            <Badge className="bg-emerald-500 text-xs">Replied</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!review.responded && (
                            <Button variant="ghost" size="sm" onClick={() => toast.success('Response template opened!')}>
                              <Reply className="h-4 w-4 mr-1" />
                              Reply
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Loyalty Dashboard ──────────────────────────────────────────── */}
        <TabsContent value="loyalty" className="space-y-4">
          {/* Tier Overview */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((tier) => {
              const config = tierConfig[tier];
              const count = loyaltyGuests.filter(g => g.tier === tier).length;
              return (
                <Card key={tier} className="p-4 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br opacity-5" style={{ backgroundImage: `linear-gradient(135deg, var(--color-primary), transparent)` }} />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('p-1.5 rounded-lg bg-gradient-to-br', config.bg)}>
                        <span className="text-white">{config.icon}</span>
                      </div>
                      <span className={cn('font-semibold capitalize', config.color)}>{tier}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">Members</div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Loyalty Guests Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Loyalty Members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead className="hidden sm:table-cell">Stays</TableHead>
                      <TableHead className="hidden md:table-cell">Total Spent</TableHead>
                      <TableHead className="hidden lg:table-cell">Next Tier</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loyaltyGuests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <Award className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No loyalty members found</p>
                        </TableCell>
                      </TableRow>
                    ) : loyaltyGuests.map((guest) => {
                      const config = tierConfig[guest.tier];
                      const tierProgress = guest.nextTierPoints > 0
                        ? Math.min((guest.points / guest.nextTierPoints) * 100, 100)
                        : 100;
                      return (
                        <TableRow key={guest.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{guest.name}</p>
                              <p className="text-xs text-muted-foreground">{guest.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs capitalize border', config.color)}>
                              {config.icon}
                              <span className="ml-1">{guest.tier}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-bold text-sm">{guest.points.toLocaleString()}</span>
                              <p className="text-xs text-muted-foreground">
                                +{guest.pointsEarned.toLocaleString()} earned
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{guest.staysCount}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">${guest.totalSpent.toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="w-24">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>{guest.nextTier}</span>
                                <span>{guest.nextTierPoints.toLocaleString()}</span>
                              </div>
                              <Progress value={tierProgress} className="h-2" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLoyaltyGuest(guest)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Redemption Catalog */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Redemption Catalog
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                {redemptionCatalog.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Gift className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No redemption rewards available</p>
                  </div>
                ) : redemptionCatalog.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-4 w-4 text-violet-500" />
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    </div>
                    <p className="text-sm font-medium line-clamp-2 mb-2">{item.name}</p>
                    <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                      <Zap className="h-3 w-3" />
                      {item.points.toLocaleString()} pts
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Personalization Engine ─────────────────────────────────────── */}
        <TabsContent value="personalization" className="space-y-4">
          {/* Guest Preference Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preferenceCards.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Target className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No guest preference data available yet</p>
              </div>
            ) : preferenceCards.map((card, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {card.guestName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm">{card.guestName}</CardTitle>
                        <CardDescription className="text-xs">Room {card.room}</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPreference(card)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Preferences Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {card.preferences.map((pref, pIdx) => (
                      <div key={pIdx} className="p-2 rounded-md bg-muted/50">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{pref.category}</p>
                        <p className="text-xs font-medium mt-0.5">{pref.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Stay Patterns */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Stay Patterns
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {card.stayPatterns.map((pattern, pIdx) => (
                        <Badge key={pIdx} variant="outline" className="text-[10px]">{pattern}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Upsells */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Upsell Recommendations
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {card.upsells.map((upsell, uIdx) => (
                        <Badge key={uIdx} className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" variant="outline">
                          {upsell}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Special Occasions */}
                  {card.specialOccasions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Upcoming Occasions
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {card.specialOccasions.map((occ, oIdx) => (
                          <Badge key={oIdx} variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
                            {occ.type} - {occ.date}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Personalization Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Personalization Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{preferenceCards.length}</div>
                  <div className="text-xs text-muted-foreground">Guests Profiled</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">94%</div>
                  <div className="text-xs text-muted-foreground">Preference Match Rate</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">2.4x</div>
                  <div className="text-xs text-muted-foreground">Upsell Conversion</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">$12.8K</div>
                  <div className="text-xs text-muted-foreground">Revenue from Upsells</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Service Request Detail Dialog ────────────────────────────────── */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequest && requestTypeIcons[selectedRequest.type]}
              Service Request {selectedRequest?.id}
            </DialogTitle>
            <DialogDescription>Full request details and management</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Guest</Label>
                  <p className="text-sm font-medium">{selectedRequest.guestName}</p>
                  <p className="text-xs text-muted-foreground">Room {selectedRequest.room}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Badge variant="outline" className={cn('mt-1 text-xs capitalize border-2', priorityConfig[selectedRequest.priority].bg, priorityConfig[selectedRequest.priority].color)}>
                    {selectedRequest.priority}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="secondary" className={cn('mt-1 text-white text-xs', statusConfig[selectedRequest.status]?.color)}>
                    {statusConfig[selectedRequest.status]?.label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    {requestTypeIcons[selectedRequest.type]}
                    <span className="text-sm">{selectedRequest.type}</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedRequest.description}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SLA Timer</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Progress
                    value={Math.min((selectedRequest.elapsedMinutes / selectedRequest.slaMinutes) * 100, 100)}
                    className="h-3 flex-1"
                  />
                  <span className={cn('text-sm font-mono font-medium', selectedRequest.elapsedMinutes > selectedRequest.slaMinutes ? 'text-red-500' : '')}>
                    {selectedRequest.elapsedMinutes}/{selectedRequest.slaMinutes} min
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <p className="text-sm mt-1">{selectedRequest.assignedTo || 'Unassigned'}</p>
              </div>
              {selectedRequest.rating && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{selectedRequest.rating}/5</span>
                    {selectedRequest.satisfactionFeedback && (
                      <span className="text-xs text-muted-foreground ml-2">- &quot;{selectedRequest.satisfactionFeedback}&quot;</span>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.success('Staff assigned!')}>
                  Assign
                </Button>
                <Button size="sm" onClick={() => { toast.success('Status updated!'); setSelectedRequest(null); }}>
                  Update Status
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Loyalty Guest Detail Dialog ─────────────────────────────────── */}
      <Dialog open={!!selectedLoyaltyGuest} onOpenChange={() => setSelectedLoyaltyGuest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {selectedLoyaltyGuest?.name}
            </DialogTitle>
            <DialogDescription>Loyalty member details</DialogDescription>
          </DialogHeader>
          {selectedLoyaltyGuest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={cn('h-14 w-14 rounded-xl bg-gradient-to-br flex items-center justify-center', tierConfig[selectedLoyaltyGuest.tier].bg)}>
                  <span className="text-white text-lg font-bold">{selectedLoyaltyGuest.name[0]}</span>
                </div>
                <div>
                  <Badge variant="outline" className={cn('text-sm capitalize border', tierConfig[selectedLoyaltyGuest.tier].color)}>
                    {tierConfig[selectedLoyaltyGuest.tier].icon}
                    <span className="ml-1">{selectedLoyaltyGuest.tier}</span>
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">Member since {selectedLoyaltyGuest.joinedAt}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xl font-bold text-primary">{selectedLoyaltyGuest.points.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Points Balance</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xl font-bold">${selectedLoyaltyGuest.totalSpent.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xl font-bold text-emerald-600">+{selectedLoyaltyGuest.pointsEarned.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Points Earned</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xl font-bold text-amber-600">-{selectedLoyaltyGuest.pointsRedeemed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Points Redeemed</div>
                </div>
              </div>
              {selectedLoyaltyGuest.nextTier !== selectedLoyaltyGuest.tier && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tier Progress to {selectedLoyaltyGuest.nextTier}</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Progress
                      value={(selectedLoyaltyGuest.points / selectedLoyaltyGuest.nextTierPoints) * 100}
                      className="h-3 flex-1"
                    />
                    <span className="text-sm font-mono">
                      {selectedLoyaltyGuest.points.toLocaleString()} / {selectedLoyaltyGuest.nextTierPoints.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {selectedLoyaltyGuest.upcomingOccasions.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Upcoming Occasions
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedLoyaltyGuest.upcomingOccasions.map((occ, i) => (
                      <Badge key={i} variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
                        {occ.type} - {occ.date}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => toast.success('Points adjusted!')}>
                  Adjust Points
                </Button>
                <Button size="sm" onClick={() => toast.success('Stay history opened!')}>
                  View Stay History
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Preference Detail Dialog ────────────────────────────────────── */}
      <Dialog open={!!selectedPreference} onOpenChange={() => setSelectedPreference(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {selectedPreference?.guestName}
            </DialogTitle>
            <DialogDescription>Guest preference profile</DialogDescription>
          </DialogHeader>
          {selectedPreference && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectedPreference.preferences.map((pref, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{pref.category}</p>
                    <p className="text-sm font-medium mt-1">{pref.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> Stay Patterns
                </p>
                <ul className="space-y-1">
                  {selectedPreference.stayPatterns.map((p, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Zap className="h-4 w-4" /> Recommended Upsells
                </p>
                <div className="space-y-2">
                  {selectedPreference.upsells.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                      <span className="text-sm">{u}</span>
                      <Button size="sm" variant="outline" onClick={() => toast.success('Upsell offered!')}>
                        Offer
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Auto-Response Config Dialog ─────────────────────────────────── */}
      <Dialog open={showAutoResponseDialog} onOpenChange={setShowAutoResponseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Auto-Response Bot Configuration
            </DialogTitle>
            <DialogDescription>Configure automated guest responses</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Auto-Response</p>
                <p className="text-xs text-muted-foreground">Automatically reply to common queries</p>
              </div>
              <button
                onClick={() => setAutoResponseConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  autoResponseConfig.enabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    autoResponseConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
            <div className="space-y-2">
              <Label>Greeting Delay (seconds)</Label>
              <Input
                type="number"
                value={autoResponseConfig.greetingDelay}
                onChange={(e) => setAutoResponseConfig(prev => ({ ...prev, greetingDelay: parseInt(e.target.value) || 30 }))}
              />
              <p className="text-xs text-muted-foreground">Time before auto-greeting is sent</p>
            </div>
            <div className="space-y-2">
              <Label>Away Message</Label>
              <Textarea
                value={autoResponseConfig.awayMessage}
                onChange={(e) => setAutoResponseConfig(prev => ({ ...prev, awayMessage: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoResponseDialog(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Auto-response config saved!'); setShowAutoResponseDialog(false); }}>
              Save Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
