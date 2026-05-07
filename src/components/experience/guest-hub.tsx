'use client';

import { useState, useMemo } from 'react';
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockConversations: Conversation[] = [
  {
    id: 'conv-1', guestName: 'Sarah Johnson', room: '304', channel: 'whatsapp',
    lastMessage: 'Can I get extra pillows sent to my room?', lastMessageAt: '2 min ago',
    unread: 2, status: 'open',
    messages: [
      { id: 'm1', from: 'guest', text: 'Hi, I have a request.', time: '10:30 AM' },
      { id: 'm2', from: 'staff', text: 'Hello Sarah! How can I help you?', time: '10:31 AM' },
      { id: 'm3', from: 'guest', text: 'Can I get extra pillows sent to my room?', time: '10:32 AM' },
      { id: 'm4', from: 'bot', text: 'We\'ll send 2 extra pillows to Room 304 right away. ETA: 10 mins.', time: '10:32 AM' },
    ],
  },
  {
    id: 'conv-2', guestName: 'Michael Chen', room: '512', channel: 'chat',
    lastMessage: 'What time does the pool close?', lastMessageAt: '15 min ago',
    unread: 0, status: 'resolved',
    messages: [
      { id: 'm5', from: 'guest', text: 'What time does the pool close?', time: '9:15 AM' },
      { id: 'm6', from: 'bot', text: 'Our pool is open from 6 AM to 10 PM daily. Enjoy your swim!', time: '9:15 AM' },
    ],
  },
  {
    id: 'conv-3', guestName: 'Emma Williams', room: '201', channel: 'email',
    lastMessage: 'Thank you for the wonderful anniversary setup!', lastMessageAt: '1 hour ago',
    unread: 1, status: 'waiting',
    messages: [
      { id: 'm7', from: 'guest', text: 'I wanted to arrange something special for our anniversary.', time: 'Yesterday' },
      { id: 'm8', from: 'staff', text: 'Congratulations! We\'ve arranged a complimentary cake and rose petals in your room.', time: 'Yesterday' },
      { id: 'm9', from: 'guest', text: 'Thank you for the wonderful anniversary setup!', time: '8:00 AM' },
    ],
  },
  {
    id: 'conv-4', guestName: 'James Rodriguez', room: '418', channel: 'sms',
    lastMessage: 'I need a late checkout tomorrow please', lastMessageAt: '30 min ago',
    unread: 1, status: 'open',
    messages: [
      { id: 'm10', from: 'guest', text: 'I need a late checkout tomorrow please', time: '8:45 AM' },
    ],
  },
  {
    id: 'conv-5', guestName: 'Aisha Patel', room: '607', channel: 'whatsapp',
    lastMessage: 'Is the restaurant open for lunch now?', lastMessageAt: '45 min ago',
    unread: 0, status: 'resolved',
    messages: [
      { id: 'm11', from: 'guest', text: 'Is the restaurant open for lunch now?', time: '8:30 AM' },
      { id: 'm12', from: 'bot', text: 'Yes! Our restaurant is open for lunch from 12 PM to 3 PM. Would you like to make a reservation?', time: '8:30 AM' },
    ],
  },
  {
    id: 'conv-6', guestName: 'David Kim', room: '102', channel: 'chat',
    lastMessage: 'The AC in my room isn\'t working properly', lastMessageAt: '5 min ago',
    unread: 3, status: 'open',
    messages: [
      { id: 'm13', from: 'guest', text: 'The AC in my room isn\'t working properly', time: '10:27 AM' },
      { id: 'm14', from: 'staff', text: 'I\'m sorry about that. Let me send maintenance right away.', time: '10:28 AM' },
      { id: 'm15', from: 'guest', text: 'Also the TV remote is missing', time: '10:28 AM' },
      { id: 'm16', from: 'bot', text: 'Maintenance ticket #M-2847 created. Technician will arrive within 15 minutes.', time: '10:29 AM' },
    ],
  },
];

const quickReplies = [
  'Thank you for reaching out! Let me check on that for you.',
  'We\'ll have someone attend to that right away.',
  'Is there anything else I can help you with?',
  'Your request has been forwarded to the relevant department.',
  'We apologize for the inconvenience. A team member will be with you shortly.',
];

const serviceRequests: ServiceRequest[] = [
  { id: 'SR-001', guestName: 'Sarah Johnson', room: '304', type: 'Housekeeping', priority: 'medium', status: 'assigned', description: 'Extra pillows and blankets requested', assignedTo: 'Maria Santos', createdAt: '10 min ago', slaMinutes: 30, elapsedMinutes: 10, rating: null, satisfactionFeedback: null },
  { id: 'SR-002', guestName: 'David Kim', room: '102', type: 'Maintenance', priority: 'high', status: 'in_progress', description: 'AC not cooling properly, TV remote missing', assignedTo: 'John Tech', createdAt: '15 min ago', slaMinutes: 15, elapsedMinutes: 15, rating: null, satisfactionFeedback: null },
  { id: 'SR-003', guestName: 'Emma Williams', room: '201', type: 'F&B', priority: 'low', status: 'resolved', description: 'Anniversary dinner reservation for 2 at 7 PM', assignedTo: 'Chef Laurent', createdAt: '2 hours ago', slaMinutes: 60, elapsedMinutes: 45, rating: 5, satisfactionFeedback: 'Perfect arrangement!' },
  { id: 'SR-004', guestName: 'James Rodriguez', room: '418', type: 'Transport', priority: 'medium', status: 'new', description: 'Airport pickup needed tomorrow at 6 AM', assignedTo: null, createdAt: '5 min ago', slaMinutes: 30, elapsedMinutes: 5, rating: null, satisfactionFeedback: null },
  { id: 'SR-005', guestName: 'Aisha Patel', room: '607', type: 'Spa', priority: 'low', status: 'assigned', description: 'Massage appointment at 3 PM today', assignedTo: 'Therapist Maya', createdAt: '1 hour ago', slaMinutes: 120, elapsedMinutes: 60, rating: null, satisfactionFeedback: null },
  { id: 'SR-006', guestName: 'Tom Baker', room: '505', type: 'Laundry', priority: 'medium', status: 'in_progress', description: 'Express dry cleaning - 3 suits needed by 5 PM', assignedTo: 'Laundry Team', createdAt: '30 min ago', slaMinutes: 45, elapsedMinutes: 30, rating: null, satisfactionFeedback: null },
  { id: 'SR-007', guestName: 'Lisa Chang', room: '310', type: 'Concierge', priority: 'medium', status: 'resolved', description: 'Broadway show tickets for tonight', assignedTo: 'Concierge Desk', createdAt: '4 hours ago', slaMinutes: 60, elapsedMinutes: 25, rating: 4, satisfactionFeedback: 'Great seats!' },
  { id: 'SR-008', guestName: 'Robert Martinez', room: '720', type: 'Wake-up Call', priority: 'low', status: 'closed', description: 'Wake-up call at 5:30 AM for early flight', assignedTo: 'System', createdAt: 'Yesterday', slaMinutes: 10, elapsedMinutes: 2, rating: 5, satisfactionFeedback: 'Right on time' },
  { id: 'SR-009', guestName: 'Nina Kowalski', room: '402', type: 'Do Not Disturb', priority: 'low', status: 'closed', description: 'DND activated until 2 PM', assignedTo: 'System', createdAt: '3 hours ago', slaMinutes: 5, elapsedMinutes: 1, rating: null, satisfactionFeedback: null },
  { id: 'SR-010', guestName: 'Chris Taylor', room: '615', type: 'Maintenance', priority: 'emergency', status: 'in_progress', description: 'Water leak in bathroom, spreading to hallway', assignedTo: 'Emergency Team', createdAt: '3 min ago', slaMinutes: 10, elapsedMinutes: 3, rating: null, satisfactionFeedback: null },
  { id: 'SR-011', guestName: 'Priya Sharma', room: '208', type: 'Housekeeping', priority: 'high', status: 'new', description: 'Room cleaning required urgently - VIP guest arriving', assignedTo: null, createdAt: '8 min ago', slaMinutes: 20, elapsedMinutes: 8, rating: null, satisfactionFeedback: null },
  { id: 'SR-012', guestName: 'Alex Thompson', room: '901', type: 'F&B', priority: 'medium', status: 'assigned', description: 'Vegan breakfast delivered to room at 8 AM', assignedTo: 'Room Service', createdAt: '45 min ago', slaMinutes: 40, elapsedMinutes: 35, rating: null, satisfactionFeedback: null },
];

const mockReviews: Review[] = [
  { id: 'R-001', guestName: 'Sarah Johnson', source: 'google', rating: 5, text: 'Absolutely stunning property! The staff went above and beyond for our anniversary celebration. Room was immaculate, and the spa was world-class.', date: 'Today', sentiment: 'positive', responded: true, responseText: 'Thank you Sarah! We\'re thrilled you enjoyed your anniversary with us. Hope to see you again!', responseSlaHours: 24, elapsedHours: 6 },
  { id: 'R-002', guestName: 'Michael Chen', source: 'tripadvisor', rating: 4, text: 'Great location and beautiful rooms. The concierge service was excellent. Only minor issue was the slow elevator during peak hours.', date: 'Yesterday', sentiment: 'positive', responded: false, responseText: null, responseSlaHours: 48, elapsedHours: 20 },
  { id: 'R-003', guestName: 'Tom Baker', source: 'booking.com', rating: 2, text: 'Room was not ready at check-in time despite arriving 2 hours late. Front desk staff seemed unorganized. Breakfast was decent though.', date: '2 days ago', sentiment: 'negative', responded: true, responseText: 'We apologize for the check-in delay. We\'ve addressed this with our front desk team and implemented new protocols.', responseSlaHours: 24, elapsedHours: 12 },
  { id: 'R-004', guestName: 'Emma Williams', source: 'google', rating: 5, text: 'The anniversary package was magical! Rose petals, champagne, and a handwritten note from the manager. Truly a memorable experience.', date: '3 days ago', sentiment: 'positive', responded: true, responseText: 'It was our pleasure to be part of your special day, Emma! Congratulations again!', responseSlaHours: 24, elapsedHours: 4 },
  { id: 'R-005', guestName: 'James Rodriguez', source: 'direct', rating: 3, text: 'Hotel is nice but nothing exceptional for the price. Gym was small and equipment was outdated. Pool area was nice.', date: '4 days ago', sentiment: 'neutral', responded: false, responseText: null, responseSlaHours: 48, elapsedHours: 40 },
  { id: 'R-006', guestName: 'Lisa Chang', source: 'tripadvisor', rating: 5, text: 'Best hotel stay I\'ve ever had! The concierge got us front-row Broadway tickets. Room service food was restaurant-quality. Will definitely return!', date: '5 days ago', sentiment: 'positive', responded: true, responseText: 'Thank you Lisa! We\'re so glad we could make your NYC trip special.', responseSlaHours: 24, elapsedHours: 8 },
  { id: 'R-007', guestName: 'David Kim', source: 'booking.com', rating: 1, text: 'Terrible experience. AC broke in the middle of the night, and it took 3 calls to get someone to look at it. Wi-Fi was spotty the entire stay.', date: '1 week ago', sentiment: 'negative', responded: true, responseText: 'We deeply apologize for the AC and Wi-Fi issues. We\'ve upgraded our HVAC system and are working on a Wi-Fi overhaul. We\'d love to make it right.', responseSlaHours: 24, elapsedHours: 18 },
  { id: 'R-008', guestName: 'Nina Kowalski', source: 'google', rating: 4, text: 'Lovely boutique hotel with character. Breakfast buffet had excellent variety. The rooftop bar has incredible city views. Would recommend!', date: '1 week ago', sentiment: 'positive', responded: false, responseText: null, responseSlaHours: 48, elapsedHours: 36 },
  { id: 'R-009', guestName: 'Chris Taylor', source: 'direct', rating: 4, text: 'Solid 4-star experience. The room was spacious and well-appointed. The spa treatment was relaxing. Minor suggestion: more power outlets.', date: '10 days ago', sentiment: 'positive', responded: true, responseText: 'Thank you for the feedback! We\'re adding USB ports to all rooms during our next renovation cycle.', responseSlaHours: 48, elapsedHours: 20 },
  { id: 'R-010', guestName: 'Priya Sharma', source: 'tripadvisor', rating: 3, text: 'Good hotel in a convenient location. Staff was polite but seemed understaffed at times. Room was clean and comfortable.', date: '2 weeks ago', sentiment: 'neutral', responded: false, responseText: null, responseSlaHours: 48, elapsedHours: 72 },
];

const reviewTrendData = [
  { period: 'Week 1', rating: 4.2, reviews: 12 },
  { period: 'Week 2', rating: 4.0, reviews: 15 },
  { period: 'Week 3', rating: 3.8, reviews: 10 },
  { period: 'Week 4', rating: 4.3, reviews: 18 },
  { period: 'Week 5', rating: 4.5, reviews: 22 },
  { period: 'Week 6', rating: 4.1, reviews: 14 },
  { period: 'Week 7', rating: 4.4, reviews: 20 },
  { period: 'Week 8', rating: 4.6, reviews: 25 },
  { period: 'Week 9', rating: 4.3, reviews: 16 },
  { period: 'Week 10', rating: 4.7, reviews: 28 },
  { period: 'Week 11', rating: 4.5, reviews: 21 },
  { period: 'Week 12', rating: 4.8, reviews: 30 },
];

const loyaltyGuests: LoyaltyGuest[] = [
  { id: 'L-001', name: 'Sarah Johnson', email: 'sarah@email.com', tier: 'platinum', points: 48500, totalSpent: 28400, staysCount: 32, pointsEarned: 14200, pointsRedeemed: 8900, nextTier: 'Diamond', nextTierPoints: 50000, joinedAt: 'Jan 2020', upcomingOccasions: [{ type: 'Anniversary', date: 'Mar 15' }] },
  { id: 'L-002', name: 'Michael Chen', email: 'mchen@email.com', tier: 'gold', points: 22300, totalSpent: 15600, staysCount: 18, pointsEarned: 7800, pointsRedeemed: 3200, nextTier: 'Platinum', nextTierPoints: 35000, joinedAt: 'Jun 2021', upcomingOccasions: [{ type: 'Birthday', date: 'Apr 22' }] },
  { id: 'L-003', name: 'Emma Williams', email: 'emma.w@email.com', tier: 'diamond', points: 87200, totalSpent: 62500, staysCount: 56, pointsEarned: 31250, pointsRedeemed: 21000, nextTier: 'Diamond', nextTierPoints: 87200, joinedAt: 'Mar 2018', upcomingOccasions: [] },
  { id: 'L-004', name: 'James Rodriguez', email: 'j.rodriguez@email.com', tier: 'silver', points: 8700, totalSpent: 5800, staysCount: 8, pointsEarned: 2900, pointsRedeemed: 1200, nextTier: 'Gold', nextTierPoints: 15000, joinedAt: 'Nov 2022', upcomingOccasions: [{ type: 'Birthday', date: 'May 8' }, { type: 'Anniversary', date: 'Jun 20' }] },
  { id: 'L-005', name: 'Lisa Chang', email: 'lchang@email.com', tier: 'gold', points: 19800, totalSpent: 13200, staysCount: 15, pointsEarned: 6600, pointsRedeemed: 4500, nextTier: 'Platinum', nextTierPoints: 35000, joinedAt: 'Sep 2020', upcomingOccasions: [] },
  { id: 'L-006', name: 'Tom Baker', email: 'tombaker@email.com', tier: 'bronze', points: 3200, totalSpent: 2100, staysCount: 3, pointsEarned: 1050, pointsRedeemed: 0, nextTier: 'Silver', nextTierPoints: 5000, joinedAt: 'Jan 2024', upcomingOccasions: [{ type: 'Birthday', date: 'Jul 14' }] },
];

const preferenceCards: PreferenceCard[] = [
  {
    guestName: 'Sarah Johnson', room: '304',
    preferences: [
      { category: 'Room Temperature', value: '21°C (70°F)' },
      { category: 'Pillow Type', value: 'Hypoallergenic Down' },
      { category: 'Dietary', value: 'Vegetarian, Gluten-Free' },
      { category: 'Minibar', value: 'Sparkling water, Green tea, Dark chocolate' },
      { category: 'TV Channel', value: 'CNN, HBO, National Geographic' },
      { category: 'Newspaper', value: 'New York Times (Digital)' },
    ],
    stayPatterns: ['Always books Deluxe Suite', 'Orders room service for breakfast', 'Uses spa on every stay', 'Requests high-floor rooms'],
    upsells: ['Couples spa package', 'Rooftop dining experience', 'Late checkout (complimentary for Platinum)'],
    specialOccasions: [{ type: 'Anniversary', date: 'Mar 15' }],
  },
  {
    guestName: 'Michael Chen', room: '512',
    preferences: [
      { category: 'Room Temperature', value: '20°C (68°F)' },
      { category: 'Pillow Type', value: 'Memory Foam, Firm' },
      { category: 'Dietary', value: 'No restrictions' },
      { category: 'Minibar', value: 'Craft beer, Mixed nuts, Energy drinks' },
      { category: 'TV Channel', value: 'ESPN, Bloomberg, CNBC' },
      { category: 'Newspaper', value: 'Wall Street Journal' },
    ],
    stayPatterns: ['Business traveler - Mon to Thu', 'Always requests gym access', 'Prefers corner rooms', 'Orders coffee at 6 AM daily'],
    upsells: ['Executive lounge access', 'Meeting room rental', 'Express laundry'],
    specialOccasions: [{ type: 'Birthday', date: 'Apr 22' }],
  },
  {
    guestName: 'Emma Williams', room: '201',
    preferences: [
      { category: 'Room Temperature', value: '22°C (72°F)' },
      { category: 'Pillow Type', value: 'Silk, Soft' },
      { category: 'Dietary', value: 'Vegan, Nut allergy' },
      { category: 'Minibar', value: 'Champagne, Organic juice, Macarons' },
      { category: 'TV Channel', value: 'Bravo, HGTV, Food Network' },
      { category: 'Newspaper', value: 'Vogue, Harper\'s Bazaar' },
    ],
    stayPatterns: ['Books suite for special occasions', 'Uses concierge for restaurant reservations', 'Always orders welcome amenity', 'Prefers king bed with ocean view'],
    upsells: ['Premium wine pairing dinner', 'Personal shopping service', 'Helicopter tour'],
    specialOccasions: [],
  },
];

const redemptionCatalog = [
  { id: 'RD-1', name: 'Free Night (Standard Room)', points: 10000, category: 'Stay' },
  { id: 'RD-2', name: 'Room Upgrade', points: 5000, category: 'Upgrade' },
  { id: 'RD-3', name: 'Spa Treatment (60 min)', points: 3000, category: 'Experience' },
  { id: 'RD-4', name: 'Dinner for Two', points: 4000, category: 'Dining' },
  { id: 'RD-5', name: 'Airport Transfer', points: 2000, category: 'Transport' },
  { id: 'RD-6', name: 'Late Checkout', points: 1500, category: 'Perk' },
  { id: 'RD-7', name: 'Bottle of Champagne', points: 2500, category: 'Dining' },
  { id: 'RD-8', name: 'Free Breakfast Buffet', points: 1200, category: 'Dining' },
  { id: 'RD-9', name: 'Fitness Class Pass', points: 500, category: 'Experience' },
  { id: 'RD-10', name: 'Poolside Cabana (Half Day)', points: 3500, category: 'Experience' },
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

  // ─── Computed ──────────────────────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    return mockConversations.filter(c => {
      if (conversationFilter === 'unread') return c.unread > 0;
      if (conversationFilter === 'open') return c.status === 'open';
      if (conversationFilter === 'waiting') return c.status === 'waiting';
      return true;
    }).filter(c =>
      !searchQuery || c.guestName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversationFilter, searchQuery]);

  const filteredRequests = useMemo(() => {
    return serviceRequests.filter(r => {
      if (requestFilter !== 'all' && r.status !== requestFilter) return false;
      if (requestTypeFilter !== 'all' && r.type !== requestTypeFilter) return false;
      return true;
    });
  }, [requestFilter, requestTypeFilter]);

  const sentimentStats = useMemo(() => {
    const total = mockReviews.length;
    const positive = mockReviews.filter(r => r.sentiment === 'positive').length;
    const neutral = mockReviews.filter(r => r.sentiment === 'neutral').length;
    const negative = mockReviews.filter(r => r.sentiment === 'negative').length;
    const avgRating = mockReviews.reduce((s, r) => s + r.rating, 0) / total;
    return { total, positive, neutral, negative, avgRating };
  }, []);

  const unrespondedReviews = mockReviews.filter(r => !r.responded);

  // ─── Render ────────────────────────────────────────────────────────────────

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
            {mockConversations.length} Conversations
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
                  <div className="text-2xl font-bold">{mockConversations.filter(c => c.status === 'open').length}</div>
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
                  <div className="text-2xl font-bold">{mockConversations.filter(c => c.unread > 0).length}</div>
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
                  <div className="text-2xl font-bold">{mockConversations.filter(c => c.status === 'resolved').length}</div>
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
                    {filteredConversations.map((conv) => (
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
                      {selectedConversation.messages.map((msg) => (
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
                    {filteredRequests.map((req) => {
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
              </div>
            </CardContent>
          </Card>

          {/* Reviews Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Reviews ({mockReviews.length})</CardTitle>
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
                    {mockReviews.map((review) => (
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
                    {loyaltyGuests.map((guest) => {
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
                {redemptionCatalog.map((item) => (
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
            {preferenceCards.map((card, idx) => (
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
