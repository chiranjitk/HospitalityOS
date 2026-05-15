'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch, Zap, Clock, Mail, MessageSquare, Bell, Tag, Users,
  BarChart3, Play, Pause, RotateCcw, Plus, ChevronRight, ChevronDown,
  MousePointer, Eye, CheckCircle2, XCircle, ArrowRight, Star,
  CalendarDays, Hotel, Send, Filter, Target, Split, Timer,
  TrendingUp, DollarSign, Activity, Copy, MoreHorizontal, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell, PieChart, Pie,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────
type NodeType = 'trigger' | 'condition' | 'action' | 'delay' | 'branch';
type JourneyStatus = 'active' | 'paused' | 'draft' | 'completed';
type ActionChannel = 'email' | 'sms' | 'push' | 'task' | 'tag' | 'segment';

interface JourneyNode {
  id: string;
  type: NodeType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  config: Record<string, string>;
  children?: JourneyNode[];
}

interface JourneyTouchpoint {
  id: string;
  name: string;
  channel: ActionChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
}

interface GuestTimelineEntry {
  id: string;
  guestName: string;
  email: string;
  journeyName: string;
  touchpoints: Array<{
    name: string;
    channel: ActionChannel;
    sentAt: string;
    status: 'sent' | 'opened' | 'clicked' | 'converted' | 'failed';
  }>;
}

interface JourneyAutomation {
  id: string;
  name: string;
  description: string;
  status: JourneyStatus;
  stage: string;
  totalEnrolled: number;
  activeContacts: number;
  completedContacts: number;
  conversionRate: number;
  revenueAttributed: number;
  touchpoints: JourneyTouchpoint[];
  nodes: JourneyNode[];
  createdAt: string;
  lastTriggered: string;
}

interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  stage: string;
  steps: number;
  avgConversionRate: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────
const JOURNEY_STAGES = ['Pre-arrival', 'Check-in', 'In-stay', 'Pre-departure', 'Post-stay', 'Re-engage'];

const TRIGGER_OPTIONS = [
  { value: 'booking_confirmed', label: 'Booking Confirmed', icon: CheckCircle2 },
  { value: 'days_before_checkin', label: 'X Days Before Check-in', icon: CalendarDays },
  { value: 'checkin_completed', label: 'Check-in Completed', icon: Hotel },
  { value: 'spend_threshold', label: 'Spend Exceeds Threshold', icon: DollarSign },
  { value: 'negative_feedback', label: 'Negative Feedback Received', icon: XCircle },
  { value: 'checkout_completed', label: 'Checkout Completed', icon: ArrowRight },
];

const ACTION_OPTIONS = [
  { value: 'send_email', label: 'Send Email', icon: Mail, channel: 'email' as ActionChannel },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, channel: 'sms' as ActionChannel },
  { value: 'send_push', label: 'Send Push Notification', icon: Bell, channel: 'push' as ActionChannel },
  { value: 'create_task', label: 'Create Task', icon: Target, channel: 'task' as ActionChannel },
  { value: 'assign_tag', label: 'Assign Tag', icon: Tag, channel: 'tag' as ActionChannel },
  { value: 'update_segment', label: 'Update Segment', icon: Users, channel: 'segment' as ActionChannel },
];

const CONDITION_OPTIONS = [
  { value: 'guest_segment', label: 'Guest Segment' },
  { value: 'stay_type', label: 'Stay Type' },
  { value: 'spending_level', label: 'Spending Level' },
  { value: 'loyalty_tier', label: 'Loyalty Tier' },
  { value: 'room_type', label: 'Room Type' },
];

const STATUS_STYLES: Record<JourneyStatus, string> = {
  active: 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 dark:from-emerald-900 dark:to-teal-900 dark:text-emerald-300',
  paused: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900 dark:to-orange-900 dark:text-amber-300',
  draft: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 dark:from-gray-800 dark:to-slate-800 dark:text-gray-300',
  completed: 'bg-gradient-to-r from-cyan-100 to-sky-100 text-cyan-800 dark:from-cyan-900 dark:to-sky-900 dark:text-cyan-300',
};

const NODE_TYPE_STYLES: Record<NodeType, string> = {
  trigger: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50',
  condition: 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/50',
  action: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50',
  delay: 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/50',
  branch: 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/50',
};

const NODE_TYPE_ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  condition: Filter,
  action: Send,
  delay: Timer,
  branch: GitBranch,
};

const CHANNEL_ICONS: Record<ActionChannel, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  task: Target,
  tag: Tag,
  segment: Users,
};

// ─── Mock Data ────────────────────────────────────────────────────────────
const JOURNEY_TEMPLATES: JourneyTemplate[] = [
  {
    id: 't1', name: 'Welcome Series', description: '3-email pre-arrival sequence to build excitement and reduce no-shows',
    stage: 'Pre-arrival', steps: 3, avgConversionRate: 72, icon: Mail, color: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 't2', name: 'In-Stay Engagement', description: 'Service requests, upsell offers, and mid-stay feedback collection',
    stage: 'In-stay', steps: 5, avgConversionRate: 58, icon: Hotel, color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 't3', name: 'Post-Stay Recovery', description: 'Review request, satisfaction survey, and return booking offer',
    stage: 'Post-stay', steps: 4, avgConversionRate: 45, icon: Star, color: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 't4', name: 'Loyalty Milestone', description: 'Tier upgrade celebration, anniversary rewards, and exclusive offers',
    stage: 'Re-engage', steps: 3, avgConversionRate: 81, icon: TrendingUp, color: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 't5', name: 'Win-Back Campaign', description: 'Re-engage guests who haven\'t returned in 6+ months',
    stage: 'Re-engage', steps: 4, avgConversionRate: 23, icon: RotateCcw, color: 'text-orange-600 dark:text-orange-400',
  },
];

const MOCK_JOURNEYS: JourneyAutomation[] = [
  {
    id: 'j1', name: 'Pre-Arrival Welcome Series', description: 'Automated welcome emails starting 14 days before check-in',
    status: 'active', stage: 'Pre-arrival',
    totalEnrolled: 4820, activeContacts: 234, completedContacts: 3942,
    conversionRate: 72.3, revenueAttributed: 186400,
    touchpoints: [
      { id: 'tp1', name: 'Booking Confirmation Email', channel: 'email', sent: 4120, opened: 3462, clicked: 1523, converted: 876 },
      { id: 'tp2', name: 'Pre-Arrival Guide (7 days)', channel: 'email', sent: 3890, opened: 3104, clicked: 1245, converted: 567 },
      { id: 'tp3', name: 'Day-Before Reminder', channel: 'sms', sent: 3650, opened: 3418, clicked: 892, converted: 423 },
    ],
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Booking Confirmed', icon: CheckCircle2, config: { trigger: 'booking_confirmed' } },
      { id: 'n2', type: 'delay', label: 'Wait 7 Days', icon: Clock, config: { duration: '7d' } },
      { id: 'n3', type: 'action', label: 'Send Pre-Arrival Guide', icon: Mail, config: { action: 'send_email' } },
      { id: 'n4', type: 'delay', label: 'Wait 6 Days', icon: Clock, config: { duration: '6d' } },
      { id: 'n5', type: 'condition', label: 'Has Room Upgrade?', icon: Filter, config: { condition: 'loyalty_tier' } },
      { id: 'n6', type: 'action', label: 'Send Upgrade Offer', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2025-09-15T10:00:00Z', lastTriggered: '2026-05-07T08:30:00Z',
  },
  {
    id: 'j2', name: 'In-Stay Upsell Engine', description: 'Mid-stay service offers based on guest segment and spending behavior',
    status: 'active', stage: 'In-stay',
    totalEnrolled: 3150, activeContacts: 187, completedContacts: 2740,
    conversionRate: 58.1, revenueAttributed: 324800,
    touchpoints: [
      { id: 'tp4', name: 'Welcome to Your Room', channel: 'push', sent: 3100, opened: 2635, clicked: 1420, converted: 789 },
      { id: 'tp5', name: 'Spa & Dining Offers', channel: 'email', sent: 2890, opened: 2023, clicked: 834, converted: 412 },
      { id: 'tp6', name: 'Mid-Stay Feedback', channel: 'sms', sent: 2650, opened: 2385, clicked: 1244, converted: 567 },
    ],
    nodes: [
      { id: 'n10', type: 'trigger', label: 'Check-in Completed', icon: Hotel, config: { trigger: 'checkin_completed' } },
      { id: 'n11', type: 'delay', label: 'Wait 2 Hours', icon: Clock, config: { duration: '2h' } },
      { id: 'n12', type: 'action', label: 'Send Welcome Push', icon: Bell, config: { action: 'send_push' } },
      { id: 'n13', type: 'condition', label: 'Spending Level?', icon: Filter, config: { condition: 'spending_level' } },
      { id: 'n14', type: 'action', label: 'Send Premium Offers', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2025-10-01T10:00:00Z', lastTriggered: '2026-05-07T09:15:00Z',
  },
  {
    id: 'j3', name: 'Post-Stay Review Campaign', description: 'Automated review requests and follow-up offers after checkout',
    status: 'active', stage: 'Post-stay',
    totalEnrolled: 5670, activeContacts: 89, completedContacts: 5230,
    conversionRate: 45.8, revenueAttributed: 97200,
    touchpoints: [
      { id: 'tp7', name: 'Thank You Email', channel: 'email', sent: 5580, opened: 4185, clicked: 2012, converted: 945 },
      { id: 'tp8', name: 'Review Request (Day 2)', channel: 'email', sent: 5310, opened: 3717, clicked: 1278, converted: 634 },
      { id: 'tp9', name: 'Return Offer (Day 5)', channel: 'email', sent: 4980, opened: 2988, clicked: 894, converted: 312 },
    ],
    nodes: [
      { id: 'n20', type: 'trigger', label: 'Checkout Completed', icon: ArrowRight, config: { trigger: 'checkout_completed' } },
      { id: 'n21', type: 'delay', label: 'Wait 1 Day', icon: Clock, config: { duration: '1d' } },
      { id: 'n22', type: 'action', label: 'Send Thank You', icon: Mail, config: { action: 'send_email' } },
      { id: 'n23', type: 'delay', label: 'Wait 1 Day', icon: Clock, config: { duration: '1d' } },
      { id: 'n24', type: 'branch', label: 'Positive Review?', icon: GitBranch, config: {} },
    ],
    createdAt: '2025-08-20T10:00:00Z', lastTriggered: '2026-05-07T07:45:00Z',
  },
  {
    id: 'j4', name: 'Loyalty Tier Celebration', description: 'Celebrate loyalty milestones with exclusive rewards and upgrades',
    status: 'active', stage: 'Re-engage',
    totalEnrolled: 1240, activeContacts: 56, completedContacts: 1089,
    conversionRate: 81.2, revenueAttributed: 267000,
    touchpoints: [
      { id: 'tp10', name: 'Tier Upgrade Congrats', channel: 'email', sent: 1180, opened: 1062, clicked: 778, converted: 456 },
      { id: 'tp11', name: 'Exclusive Benefits Offer', channel: 'email', sent: 1100, opened: 935, clicked: 572, converted: 389 },
      { id: 'tp12', name: 'Anniversary Reward', channel: 'push', sent: 890, opened: 801, clicked: 423, converted: 234 },
    ],
    nodes: [
      { id: 'n30', type: 'trigger', label: 'Loyalty Tier Change', icon: Star, config: { trigger: 'loyalty_tier' } },
      { id: 'n31', type: 'action', label: 'Send Congrats Email', icon: Mail, config: { action: 'send_email' } },
      { id: 'n32', type: 'delay', label: 'Wait 3 Days', icon: Clock, config: { duration: '3d' } },
      { id: 'n33', type: 'action', label: 'Send Exclusive Offer', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2025-11-05T10:00:00Z', lastTriggered: '2026-05-06T14:20:00Z',
  },
  {
    id: 'j5', name: 'Win-Back Dormant Guests', description: 'Re-engage guests who haven\'t booked in 6+ months',
    status: 'active', stage: 'Re-engage',
    totalEnrolled: 8920, activeContacts: 342, completedContacts: 7456,
    conversionRate: 23.4, revenueAttributed: 145600,
    touchpoints: [
      { id: 'tp13', name: 'We Miss You Email', channel: 'email', sent: 8760, opened: 3504, clicked: 1051, converted: 312 },
      { id: 'tp14', name: 'Special Discount Offer', channel: 'email', sent: 6230, opened: 2492, clicked: 748, converted: 234 },
      { id: 'tp15', name: 'Final Offer (30% Off)', channel: 'email', sent: 4120, opened: 1648, clicked: 494, converted: 178 },
    ],
    nodes: [
      { id: 'n40', type: 'trigger', label: '180 Days Since Last Stay', icon: Clock, config: { trigger: 'days_since_stay' } },
      { id: 'n41', type: 'condition', label: 'VIP Guest?', icon: Filter, config: { condition: 'loyalty_tier' } },
      { id: 'n42', type: 'action', label: 'Send VIP Offer', icon: Mail, config: { action: 'send_email' } },
      { id: 'n43', type: 'delay', label: 'Wait 14 Days', icon: Clock, config: { duration: '14d' } },
      { id: 'n44', type: 'action', label: 'Send Discount', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2025-07-10T10:00:00Z', lastTriggered: '2026-05-07T06:00:00Z',
  },
  {
    id: 'j6', name: 'Negative Feedback Recovery', description: 'Immediate follow-up when negative feedback is received',
    status: 'active', stage: 'In-stay',
    totalEnrolled: 890, activeContacts: 23, completedContacts: 834,
    conversionRate: 67.5, revenueAttributed: 45600,
    touchpoints: [
      { id: 'tp16', name: 'Apology & Resolution', channel: 'sms', sent: 875, opened: 831, clicked: 375, converted: 245 },
      { id: 'tp17', name: 'Service Recovery Offer', channel: 'email', sent: 812, opened: 649, clicked: 276, converted: 189 },
      { id: 'tp18', name: 'Follow-up Satisfaction', channel: 'email', sent: 780, opened: 546, clicked: 218, converted: 134 },
    ],
    nodes: [
      { id: 'n50', type: 'trigger', label: 'Negative Feedback', icon: XCircle, config: { trigger: 'negative_feedback' } },
      { id: 'n51', type: 'delay', label: 'Wait 30 Min', icon: Clock, config: { duration: '30m' } },
      { id: 'n52', type: 'action', label: 'Send Apology SMS', icon: MessageSquare, config: { action: 'send_sms' } },
      { id: 'n53', type: 'action', label: 'Create Follow-up Task', icon: Target, config: { action: 'create_task' } },
    ],
    createdAt: '2025-12-01T10:00:00Z', lastTriggered: '2026-05-06T22:10:00Z',
  },
  {
    id: 'j7', name: 'Pre-Departure Checkout Flow', description: 'Express checkout, folio review, and departure-day reminders',
    status: 'paused', stage: 'Pre-departure',
    totalEnrolled: 2340, activeContacts: 0, completedContacts: 2190,
    conversionRate: 61.2, revenueAttributed: 78900,
    touchpoints: [
      { id: 'tp19', name: 'Folio Review Reminder', channel: 'email', sent: 2280, opened: 1824, clicked: 912, converted: 567 },
      { id: 'tp20', name: 'Express Checkout Offer', channel: 'push', sent: 2100, opened: 1890, clicked: 840, converted: 523 },
    ],
    nodes: [
      { id: 'n60', type: 'trigger', label: '1 Day Before Checkout', icon: CalendarDays, config: { trigger: 'days_before_checkout' } },
      { id: 'n61', type: 'action', label: 'Send Folio Review', icon: Mail, config: { action: 'send_email' } },
      { id: 'n62', type: 'delay', label: 'Wait 12 Hours', icon: Clock, config: { duration: '12h' } },
      { id: 'n63', type: 'action', label: 'Send Express Checkout', icon: Bell, config: { action: 'send_push' } },
    ],
    createdAt: '2026-01-15T10:00:00Z', lastTriggered: '2026-05-05T08:00:00Z',
  },
  {
    id: 'j8', name: 'High-Spender VIP Path', description: 'Premium journey for guests whose spending exceeds $2,000 threshold',
    status: 'active', stage: 'In-stay',
    totalEnrolled: 456, activeContacts: 34, completedContacts: 389,
    conversionRate: 74.8, revenueAttributed: 412000,
    touchpoints: [
      { id: 'tp21', name: 'VIP Welcome Package', channel: 'email', sent: 448, opened: 426, clicked: 298, converted: 212 },
      { id: 'tp22', name: 'Exclusive Upsell Offer', channel: 'email', sent: 412, opened: 354, clicked: 212, converted: 167 },
      { id: 'tp23', name: 'Personalized Thank You', channel: 'email', sent: 389, opened: 350, clicked: 198, converted: 145 },
    ],
    nodes: [
      { id: 'n70', type: 'trigger', label: 'Spend > $2,000', icon: DollarSign, config: { trigger: 'spend_threshold' } },
      { id: 'n71', type: 'action', label: 'Tag as VIP', icon: Tag, config: { action: 'assign_tag' } },
      { id: 'n72', type: 'delay', label: 'Wait 4 Hours', icon: Clock, config: { duration: '4h' } },
      { id: 'n73', type: 'action', label: 'Send VIP Package', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2026-02-20T10:00:00Z', lastTriggered: '2026-05-07T03:45:00Z',
  },
  {
    id: 'j9', name: 'Check-in Day Experience', description: 'Streamlined check-in communication with digital key and room info',
    status: 'draft', stage: 'Check-in',
    totalEnrolled: 0, activeContacts: 0, completedContacts: 0,
    conversionRate: 0, revenueAttributed: 0,
    touchpoints: [
      { id: 'tp24', name: 'Check-in Day Welcome', channel: 'push', sent: 0, opened: 0, clicked: 0, converted: 0 },
      { id: 'tp25', name: 'Digital Key Delivery', channel: 'push', sent: 0, opened: 0, clicked: 0, converted: 0 },
      { id: 'tp26', name: 'Room Upgrade Offer', channel: 'email', sent: 0, opened: 0, clicked: 0, converted: 0 },
    ],
    nodes: [
      { id: 'n80', type: 'trigger', label: 'Check-in Day', icon: CalendarDays, config: { trigger: 'checkin_day' } },
      { id: 'n81', type: 'action', label: 'Send Digital Key', icon: Bell, config: { action: 'send_push' } },
      { id: 'n82', type: 'delay', label: 'Wait 1 Hour', icon: Clock, config: { duration: '1h' } },
      { id: 'n83', type: 'condition', label: 'Upgrade Available?', icon: Filter, config: { condition: 'room_type' } },
      { id: 'n84', type: 'action', label: 'Send Upgrade Offer', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2026-05-01T10:00:00Z', lastTriggered: '',
  },
  {
    id: 'j10', name: 'Group Booking Coordinator', description: 'Automated coordination for group bookings with pre/post communications',
    status: 'completed', stage: 'Pre-arrival',
    totalEnrolled: 670, activeContacts: 0, completedContacts: 670,
    conversionRate: 89.1, revenueAttributed: 534000,
    touchpoints: [
      { id: 'tp27', name: 'Group Welcome Package', channel: 'email', sent: 665, opened: 612, clicked: 489, converted: 398 },
      { id: 'tp28', name: 'Group Itinerary', channel: 'email', sent: 650, opened: 585, clicked: 412, converted: 367 },
      { id: 'tp29', name: 'Group Feedback Survey', channel: 'email', sent: 640, opened: 512, clicked: 326, converted: 278 },
    ],
    nodes: [
      { id: 'n90', type: 'trigger', label: 'Group Booking Created', icon: Users, config: { trigger: 'group_booking' } },
      { id: 'n91', type: 'action', label: 'Send Group Welcome', icon: Mail, config: { action: 'send_email' } },
      { id: 'n92', type: 'delay', label: 'Wait 3 Days', icon: Clock, config: { duration: '3d' } },
      { id: 'n93', type: 'action', label: 'Send Itinerary', icon: Mail, config: { action: 'send_email' } },
    ],
    createdAt: '2025-06-01T10:00:00Z', lastTriggered: '2026-04-28T16:30:00Z',
  },
];

const MOCK_GUEST_TIMELINE: GuestTimelineEntry[] = [
  {
    id: 'gt1', guestName: 'Sarah Mitchell', email: 'sarah.m@email.com', journeyName: 'Pre-Arrival Welcome Series',
    touchpoints: [
      { name: 'Booking Confirmation', channel: 'email', sentAt: '2026-04-23T10:00:00Z', status: 'opened' },
      { name: 'Pre-Arrival Guide', channel: 'email', sentAt: '2026-04-30T10:00:00Z', status: 'clicked' },
      { name: 'Day-Before Reminder', channel: 'sms', sentAt: '2026-05-06T10:00:00Z', status: 'converted' },
    ],
  },
  {
    id: 'gt2', guestName: 'James Cooper', email: 'j.cooper@email.com', journeyName: 'In-Stay Upsell Engine',
    touchpoints: [
      { name: 'Welcome to Your Room', channel: 'push', sentAt: '2026-05-05T14:00:00Z', status: 'opened' },
      { name: 'Spa & Dining Offers', channel: 'email', sentAt: '2026-05-06T09:00:00Z', status: 'converted' },
    ],
  },
  {
    id: 'gt3', guestName: 'Elena Rodriguez', email: 'elena.r@email.com', journeyName: 'Loyalty Tier Celebration',
    touchpoints: [
      { name: 'Tier Upgrade Congrats', channel: 'email', sentAt: '2026-05-01T10:00:00Z', status: 'converted' },
      { name: 'Exclusive Benefits Offer', channel: 'email', sentAt: '2026-05-04T10:00:00Z', status: 'clicked' },
    ],
  },
  {
    id: 'gt4', guestName: 'David Park', email: 'd.park@email.com', journeyName: 'Win-Back Dormant Guests',
    touchpoints: [
      { name: 'We Miss You Email', channel: 'email', sentAt: '2026-04-15T10:00:00Z', status: 'opened' },
      { name: 'Special Discount Offer', channel: 'email', sentAt: '2026-04-29T10:00:00Z', status: 'opened' },
      { name: 'Final Offer (30% Off)', channel: 'email', sentAt: '2026-05-05T10:00:00Z', status: 'failed' },
    ],
  },
  {
    id: 'gt5', guestName: 'Maria Chen', email: 'm.chen@email.com', journeyName: 'Negative Feedback Recovery',
    touchpoints: [
      { name: 'Apology & Resolution', channel: 'sms', sentAt: '2026-05-06T15:30:00Z', status: 'converted' },
      { name: 'Service Recovery Offer', channel: 'email', sentAt: '2026-05-06T16:30:00Z', status: 'sent' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────
export default function JourneyAutomation() {
  const [journeys, setJourneys] = useState<JourneyAutomation[]>([]);
  const [guestTimeline, setGuestTimeline] = useState<GuestTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<JourneyAutomation | null>(null);
  const [activeTab, setActiveTab] = useState('journeys');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);
  const [builderDialogOpen, setBuilderDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Fetch real automation rules and execution logs
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const rulesRes = await fetch('/api/automation/rules?type=journey');
        if (rulesRes.ok && !cancelled) {
          const data = await rulesRes.json();
          const items = Array.isArray(data) ? data : data.rules || [];
          if (items.length > 0) {
            setJourneys(items.map((r: Record<string, unknown>) => ({
              id: r.id || `j-${Date.now()}`,
              name: r.name || r.title || 'Unnamed Journey',
              description: r.description || '',
              status: (r.status || 'draft') as JourneyStatus,
              stage: r.stage || r.category || 'General',
              totalEnrolled: Number(r.totalEnrolled || r.enrolledContacts || 0),
              activeContacts: Number(r.activeContacts || r.currentActive || 0),
              completedContacts: Number(r.completedContacts || 0),
              conversionRate: Number(r.conversionRate || r.conversion || 0),
              revenueAttributed: Number(r.revenueAttributed || r.revenue || 0),
              touchpoints: Array.isArray(r.touchpoints) ? r.touchpoints.map((tp: Record<string, unknown>) => ({
                id: tp.id || `tp-${Date.now()}`, name: String(tp.name || tp.title || 'Touchpoint'),
                channel: (tp.channel || 'email') as ActionChannel,
                sent: Number(tp.sent || 0), opened: Number(tp.opened || tp.opens || 0),
                clicked: Number(tp.clicked || tp.clicks || 0), converted: Number(tp.converted || tp.conversions || 0),
              })) : [],
              nodes: [], createdAt: r.createdAt || new Date().toISOString(),
              lastTriggered: r.lastTriggeredAt || r.lastTriggered || r.updatedAt || '',
            })));
          } else { setJourneys(MOCK_JOURNEYS); }
        } else { setJourneys(MOCK_JOURNEYS); }
        const logsRes = await fetch('/api/automation/execution-logs?limit=20');
        if (logsRes.ok && !cancelled) {
          const logsData = await logsRes.json();
          const logs = Array.isArray(logsData) ? logsData : logsData.logs || logsData.entries || [];
          setGuestTimeline(logs.slice(0, 10).map((log: Record<string, unknown>) => ({
            id: log.id || `gt-${Date.now()}`,
            guestName: log.guestName || `${log.guestFirstName || ''} ${log.guestLastName || ''}`.trim() || 'Guest',
            email: log.email || log.guestEmail || '',
            journeyName: log.journeyName || log.ruleName || log.automationName || 'Journey',
            touchpoints: Array.isArray(log.touchpoints) ? log.touchpoints.map((tp: Record<string, unknown>) => ({
              name: String(tp.name || tp.action || 'Action'),
              channel: (tp.channel || 'email') as ActionChannel,
              sentAt: tp.sentAt || tp.createdAt || tp.executedAt || '',
              status: (tp.status || tp.result || 'sent') as 'sent' | 'opened' | 'clicked' | 'converted' | 'failed',
            })) : [],
          })));
        }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load automation data'); setJourneys(MOCK_JOURNEYS); }
      } finally { if (!cancelled) setLoading(false); }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const filteredJourneys = journeys.filter((j) => {
    const matchSearch = j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStage = stageFilter === 'all' || j.stage === stageFilter;
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStage && matchStatus;
  });

  const totalActive = journeys.filter(j => j.status === 'active').length;
  const totalEnrolled = journeys.reduce((a, j) => a + j.totalEnrolled, 0);
  const avgConversion = journeys.filter(j => j.conversionRate > 0)
    .reduce((a, j) => a + j.conversionRate, 0) / journeys.filter(j => j.conversionRate > 0).length;
  const totalRevenue = journeys.reduce((a, j) => a + j.revenueAttributed, 0);

  const getFunnelData = (journey: JourneyAutomation) => {
    if (!journey.touchpoints.length) return [];
    const first = journey.touchpoints[0];
    const last = journey.touchpoints[journey.touchpoints.length - 1];
    return journey.touchpoints.map((tp, idx) => ({
      name: `Step ${idx + 1}`,
      value: tp.sent,
      label: tp.name,
      fill: idx === 0 ? '#10b981' : idx === journey.touchpoints.length - 1 ? '#f59e0b' : '#6366f1',
    }));
  };

  const getChannelIcon = (channel: ActionChannel) => {
    const Icon = CHANNEL_ICONS[channel] || Mail;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send className="h-3.5 w-3.5 text-sky-500" />;
      case 'opened': return <Eye className="h-3.5 w-3.5 text-emerald-500" />;
      case 'clicked': return <MousePointer className="h-3.5 w-3.5 text-violet-500" />;
      case 'converted': return <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />;
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <Mail className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  const toggleJourneyStatus = (id: string) => {
    setJourneys(prev => prev.map(j =>
      j.id === id
        ? { ...j, status: j.status === 'active' ? 'paused' : 'active' as JourneyStatus }
        : j
    ));
  };

  const duplicateJourney = (id: string) => {
    const source = journeys.find(j => j.id === id);
    if (source) {
      const copy = {
        ...source,
        id: `j_${Date.now()}`,
        name: `${source.name} (Copy)`,
        status: 'draft' as JourneyStatus,
        totalEnrolled: 0,
        activeContacts: 0,
        completedContacts: 0,
        conversionRate: 0,
        revenueAttributed: 0,
        createdAt: new Date().toISOString(),
        touchpoints: source.touchpoints.map(tp => ({ ...tp, sent: 0, opened: 0, clicked: 0, converted: 0 })),
      };
      setJourneys(prev => [...prev, copy]);
    }
  };

  const getRevenueBarData = () => journeys
    .filter(j => j.revenueAttributed > 0)
    .sort((a, b) => b.revenueAttributed - a.revenueAttributed)
    .slice(0, 6)
    .map(j => ({
      name: j.name.length > 18 ? j.name.slice(0, 18) + '...' : j.name,
      revenue: j.revenueAttributed,
      fill: '#10b981',
    }));

  const getConversionPieData = () => {
    const high = journeys.filter(j => j.conversionRate >= 60).length;
    const mid = journeys.filter(j => j.conversionRate >= 30 && j.conversionRate < 60).length;
    const low = journeys.filter(j => j.conversionRate > 0 && j.conversionRate < 30).length;
    return [
      { name: 'High (60%+)', value: high, fill: '#10b981' },
      { name: 'Medium (30-59%)', value: mid, fill: '#f59e0b' },
      { name: 'Low (<30%)', value: low, fill: '#ef4444' },
    ];
  };

  const renderNodeVisual = (node: JourneyNode, index: number, isLast: boolean) => {
    const NodeIcon = node.icon;
    return (
      <div key={node.id} className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className={cn(
            'w-10 h-10 rounded-lg border-2 flex items-center justify-center shadow-sm',
            NODE_TYPE_STYLES[node.type]
          )}>
            <NodeIcon className="h-5 w-5 text-foreground" />
          </div>
          {!isLast && (
            <div className="w-0.5 h-6 bg-border mt-1" />
          )}
        </div>
        <div className="pt-1.5 min-w-0">
          <p className="text-sm font-medium leading-tight">{node.label}</p>
          <Badge variant="outline" className="text-[10px] mt-1 px-1.5 py-0">
            {node.type}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journey Automation</h1>
          <p className="text-muted-foreground">
            Design, deploy, and track automated guest journey workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200" onClick={() => setBuilderDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Journey
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
          {[1,2,3,4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-24" /></CardContent></Card>)}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700">Failed to load automation data</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (<>
      {/* Overview Stats */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Journeys</p>
                <p className="text-xl font-bold">{totalActive}</p>
              </div>
              <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Enrolled</p>
                <p className="text-xl font-bold">{totalEnrolled.toLocaleString()}</p>
              </div>
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Conversion</p>
                <p className="text-xl font-bold">{avgConversion.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Revenue Attributed</p>
                <p className="text-xl font-bold">${(totalRevenue / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="journeys">Active Journeys</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="timeline">Contact Timeline</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* ─── Active Journeys Tab ───────────────────────────────────── */}
        <TabsContent value="journeys" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search journeys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {JOURNEY_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Journey Cards */}
          <div className="space-y-3">
            {filteredJourneys.map((journey) => {
              const isExpanded = expandedJourney === journey.id;
              return (
                <Card key={journey.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <CardContent className="p-4 sm:p-6">
                    {/* Journey Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
                          <GitBranch className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-base">{journey.name}</h3>
                            <Badge className={cn(STATUS_STYLES[journey.status], 'shadow-sm')}>
                              {journey.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{journey.stage}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{journey.description}</p>

                          {/* Quick Stats Row */}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {journey.totalEnrolled.toLocaleString()} enrolled
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-3.5 w-3.5" />
                              {journey.activeContacts} active
                            </span>
                            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="h-3.5 w-3.5" />
                              {journey.conversionRate}% converted
                            </span>
                            <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                              <DollarSign className="h-3.5 w-3.5" />
                              ${(journey.revenueAttributed / 1000).toFixed(0)}K revenue
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleJourneyStatus(journey.id)}
                          disabled={journey.status === 'draft' || journey.status === 'completed'}
                        >
                          {journey.status === 'active' ? (
                            <><Pause className="h-3.5 w-3.5 mr-1.5" />Pause</>
                          ) : journey.status === 'paused' ? (
                            <><Play className="h-3.5 w-3.5 mr-1.5" />Resume</>
                          ) : (
                            <><Play className="h-3.5 w-3.5 mr-1.5" />Start</>
                          )}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => duplicateJourney(journey.id)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedJourney(journey)}>
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedJourney(isExpanded ? null : journey.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: Workflow Nodes */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t">
                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Workflow Steps
                        </h4>
                        <div className="flex gap-6 overflow-x-auto pb-2">
                          <ScrollArea className="w-full">
                            <div className="flex items-start min-w-max">
                              {journey.nodes.map((node, idx) => (
                                <div key={node.id} className="flex items-start">
                                  {renderNodeVisual(node, idx, idx === journey.nodes.length - 1)}
                                  {idx < journey.nodes.length - 1 && (
                                    <div className="flex items-center pt-4 px-2">
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Touchpoint Performance */}
                        {journey.touchpoints.length > 0 && (
                          <div className="mt-6">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                              Touchpoint Performance
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {journey.touchpoints.map((tp) => (
                                <div key={tp.id} className="p-3 rounded-lg border bg-muted/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    {getChannelIcon(tp.channel)}
                                    <span className="text-sm font-medium truncate">{tp.name}</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <div>
                                      <p className="font-semibold">{tp.sent}</p>
                                      <p className="text-muted-foreground">Sent</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{tp.sent > 0 ? ((tp.opened / tp.sent) * 100).toFixed(0) : 0}%</p>
                                      <p className="text-muted-foreground">Open</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-cyan-600 dark:text-cyan-400">{tp.sent > 0 ? ((tp.clicked / tp.sent) * 100).toFixed(0) : 0}%</p>
                                      <p className="text-muted-foreground">Click</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-amber-600 dark:text-amber-400">{tp.sent > 0 ? ((tp.converted / tp.sent) * 100).toFixed(0) : 0}%</p>
                                      <p className="text-muted-foreground">Convert</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Analytics Tab ──────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue by Journey */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Journey</CardTitle>
                <CardDescription>Top performing journeys by attributed revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getRevenueBarData()} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tickFormatter={(v) => `$${v / 1000}K`} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={140} fontSize={10} tickLine={false} />
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {getRevenueBarData().map((entry, idx) => (
                          <Cell key={idx} fill={['#10b981', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 6]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion Distribution</CardTitle>
                <CardDescription>Journeys by conversion rate tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getConversionPieData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {getConversionPieData().map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stage-wise Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance by Guest Journey Stage</CardTitle>
              <CardDescription>Enrollment and conversion across journey stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-6 gap-3">
                    {JOURNEY_STAGES.map((stage) => {
                      const stageJourneys = journeys.filter(j => j.stage === stage);
                      const enroll = stageJourneys.reduce((a, j) => a + j.totalEnrolled, 0);
                      const conv = stageJourneys.length > 0
                        ? stageJourneys.reduce((a, j) => a + j.conversionRate, 0) / stageJourneys.length
                        : 0;
                      const rev = stageJourneys.reduce((a, j) => a + j.revenueAttributed, 0);
                      return (
                        <div key={stage} className="p-4 rounded-xl border bg-gradient-to-b from-muted/50 to-background text-center space-y-3">
                          <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-primary" />
                          </div>
                          <p className="font-semibold text-sm">{stage}</p>
                          <p className="text-xs text-muted-foreground">{stageJourneys.length} journeys</p>
                          <Separator />
                          <div className="space-y-1.5 text-xs">
                            <div>
                              <p className="font-bold text-base">{enroll.toLocaleString()}</p>
                              <p className="text-muted-foreground">Enrolled</p>
                            </div>
                            <div>
                              <p className="font-bold text-base text-emerald-600 dark:text-emerald-400">{conv.toFixed(1)}%</p>
                              <p className="text-muted-foreground">Avg Conv.</p>
                            </div>
                            <div>
                              <p className="font-bold text-base text-amber-600 dark:text-amber-400">${(rev / 1000).toFixed(0)}K</p>
                              <p className="text-muted-foreground">Revenue</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Touchpoint Channel Mix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channel Performance Summary</CardTitle>
              <CardDescription>Aggregate metrics across all journeys by channel type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(['email', 'sms', 'push'] as const).map((channel) => {
                  const allTPs = journeys.flatMap(j => j.touchpoints).filter(tp => tp.channel === channel);
                  const totalSent = allTPs.reduce((a, tp) => a + tp.sent, 0);
                  const totalOpened = allTPs.reduce((a, tp) => a + tp.opened, 0);
                  const totalClicked = allTPs.reduce((a, tp) => a + tp.clicked, 0);
                  const totalConverted = allTPs.reduce((a, tp) => a + tp.converted, 0);
                  const ChIcon = CHANNEL_ICONS[channel];
                  return (
                    <div key={channel} className="p-4 rounded-xl border space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ChIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold capitalize">{channel}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <p className="font-bold text-sm">{totalSent.toLocaleString()}</p>
                          <p className="text-muted-foreground">Sent</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-emerald-600">{totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : 0}%</p>
                          <p className="text-muted-foreground">Open</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-cyan-600">{totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : 0}%</p>
                          <p className="text-muted-foreground">Click</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-amber-600">{totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : 0}%</p>
                          <p className="text-muted-foreground">Convert</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Contact Timeline Tab ───────────────────────────────────── */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Guest Contact Timeline
              </CardTitle>
              <CardDescription>All automated touchpoints sent to guests across all journeys</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-4">
                  {guestTimeline.length > 0 ? guestTimeline.map((entry) => (
                    <div key={entry.id} className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                            {entry.guestName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{entry.guestName}</p>
                            <p className="text-xs text-muted-foreground">{entry.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{entry.journeyName}</Badge>
                      </div>
                      <div className="pl-13 space-y-2">
                        {entry.touchpoints.map((tp, idx) => (
                          <div key={idx} className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-border">
                            <div className="shrink-0">{getStatusIcon(tp.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getChannelIcon(tp.channel)}
                                <span className="text-sm font-medium">{tp.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tp.sentAt).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs capitalize',
                                tp.status === 'converted' && 'text-emerald-600 border-emerald-300 dark:text-emerald-400',
                                tp.status === 'failed' && 'text-red-600 border-red-300 dark:text-red-400',
                                tp.status === 'clicked' && 'text-violet-600 border-violet-300 dark:text-violet-400',
                              )}
                            >
                              {tp.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Templates Tab ──────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOURNEY_TEMPLATES.map((template) => {
              const TemplateIcon = template.icon;
              return (
                <Card key={template.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 group cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <TemplateIcon className={cn('h-6 w-6', template.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge variant="outline" className="text-xs mt-1">{template.stage}</Badge>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{template.description}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span>{template.steps} steps</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{template.avgConversionRate}% avg conv.</span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-4">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Custom Journey Card */}
            <Card className="border-dashed border-2 hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => setBuilderDialogOpen(true)}>
              <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-semibold">Build Custom Journey</p>
                <p className="text-sm text-muted-foreground mt-1">Create a journey from scratch</p>
              </CardContent>
          </div>
        </TabsContent>
      </Tabs>
      </>)}

      {/* ─── Journey Detail Dialog ────────────────────────────────────── */}
      <Dialog open={!!selectedJourney} onOpenChange={() => setSelectedJourney(null)}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedJourney?.name}</DialogTitle>
            <DialogDescription>Conversion funnel and performance details</DialogDescription>
          </DialogHeader>
          {selectedJourney && (
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-center">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{selectedJourney.totalEnrolled.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Enrolled</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-center">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{selectedJourney.activeContacts}</p>
                    <p className="text-xs text-muted-foreground">Active Now</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-center">
                    <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{selectedJourney.conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Conversion Rate</p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-center">
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-300">${selectedJourney.revenueAttributed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                </div>

                {/* Funnel Visualization */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedJourney.touchpoints.map((tp, idx) => {
                        const prevSent = idx === 0 ? tp.sent : selectedJourney.touchpoints[idx - 1].sent;
                        const dropOff = prevSent > 0 ? (((prevSent - tp.sent) / prevSent) * 100).toFixed(1) : '0';
                        return (
                          <div key={tp.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {getChannelIcon(tp.channel)}
                                <span className="font-medium">{tp.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{tp.sent.toLocaleString()} sent</span>
                                {idx > 0 && (
                                  <span className="text-red-500 dark:text-red-400">-{dropOff}% drop</span>
                                )}
                              </div>
                            </div>
                            <div className="relative h-8 rounded-md bg-muted overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                                style={{ width: `${prevSent > 0 ? (tp.sent / selectedJourney.touchpoints[0].sent) * 100 : 0}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground">
                                {tp.sent.toLocaleString()}
                              </div>
                            </div>
                            {/* Rates */}
                            <div className="flex gap-4 text-[10px] text-muted-foreground ml-1">
                              <span>Open: {tp.sent > 0 ? ((tp.opened / tp.sent) * 100).toFixed(1) : 0}%</span>
                              <span>Click: {tp.sent > 0 ? ((tp.clicked / tp.sent) * 100).toFixed(1) : 0}%</span>
                              <span>Convert: {tp.sent > 0 ? ((tp.converted / tp.sent) * 100).toFixed(1) : 0}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Overall Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Journey Progress</span>
                    <span className="text-muted-foreground">
                      {selectedJourney.totalEnrolled > 0
                        ? ((selectedJourney.completedContacts / selectedJourney.totalEnrolled) * 100).toFixed(1)
                        : 0}% completed
                    </span>
                  </div>
                  <Progress
                    value={selectedJourney.totalEnrolled > 0
                      ? (selectedJourney.completedContacts / selectedJourney.totalEnrolled) * 100
                      : 0}
                    className="h-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{selectedJourney.completedContacts.toLocaleString()} completed</span>
                    <span>{selectedJourney.activeContacts} still active</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Journey Builder Dialog ───────────────────────────────────── */}
      <Dialog open={builderDialogOpen} onOpenChange={setBuilderDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Journey Builder
            </DialogTitle>
            <DialogDescription>Design your automated guest journey workflow</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-6 py-4">
              {/* Journey Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Journey Name</label>
                  <Input placeholder="e.g., VIP Welcome Sequence" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Journey Stage</label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                    <SelectContent>
                      {JOURNEY_STAGES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea placeholder="Describe the purpose of this journey..." rows={2} />
              </div>

              <Separator />

              {/* Node Palette */}
              <div>
                <h4 className="font-semibold mb-3">Add Nodes</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {([
                    { type: 'trigger' as NodeType, label: 'Trigger', icon: Zap, color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' },
                    { type: 'condition' as NodeType, label: 'Condition', icon: Filter, color: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' },
                    { type: 'action' as NodeType, label: 'Action', icon: Send, color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' },
                    { type: 'delay' as NodeType, label: 'Delay', icon: Timer, color: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' },
                    { type: 'branch' as NodeType, label: 'Branch', icon: GitBranch, color: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' },
                  ]).map(({ type, label, icon: NodeIcon, color }) => (
                    <Button
                      key={type}
                      variant="outline"
                      className={cn('flex flex-col gap-1 h-auto py-3 hover:shadow-md transition-all', color)}
                      onClick={() => {}}
                    >
                      <NodeIcon className="h-5 w-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Configuration Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Triggers Config */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" /> Trigger Options
                  </h4>
                  <div className="space-y-2">
                    {TRIGGER_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                        <opt.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions Config */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-500" /> Action Options
                  </h4>
                  <div className="space-y-2">
                    {ACTION_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                        <opt.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Conditions Config */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4 text-violet-500" /> Condition Options
                </h4>
                <div className="flex flex-wrap gap-2">
                  {CONDITION_OPTIONS.map(opt => (
                    <Badge key={opt.value} variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors">
                      {opt.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Visual Canvas Placeholder */}
              <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/20">
                <GitBranch className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Drag nodes here to build your journey</p>
                <p className="text-xs text-muted-foreground mt-1">Connect nodes by dragging from one output to another input</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuilderDialogOpen(false)}>Cancel</Button>
            <Button variant="outline">Save as Draft</Button>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md">
              Activate Journey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Template Selection Dialog ────────────────────────────────── */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose a Journey Template</DialogTitle>
            <DialogDescription>Start with a pre-built journey and customize it</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-3 py-4">
              {JOURNEY_TEMPLATES.map((template) => {
                const TIcon = template.icon;
                return (
                  <Card key={template.id} className="hover:shadow-md transition-all cursor-pointer" onClick={() => {
                    setTemplateDialogOpen(false);
                    setBuilderDialogOpen(true);
                  }}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TIcon className={cn('h-5 w-5', template.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{template.name}</h4>
                          <Badge variant="outline" className="text-xs">{template.stage}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{template.steps} steps</span>
                          <span className="text-emerald-600 font-medium">{template.avgConversionRate}% conv.</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
