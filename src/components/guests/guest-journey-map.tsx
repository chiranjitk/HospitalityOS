'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CalendarCheck,
  Mail,
  Luggage,
  LogIn,
  Key,
  Gift,
  UtensilsCrossed,
  Sparkles,
  Brush,
  Wine,
  Car,
  Heart,
  MessageSquare,
  LogOut,
  CreditCard,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Route,
  Wifi,
  Coffee,
  Hotel,
  UserCheck,
  Package,
  Stethoscope,
  Flag,
  Award,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

type TouchpointStatus = 'completed' | 'in-progress' | 'upcoming';
type JourneyPhase = 'pre-arrival' | 'arrival' | 'in-stay' | 'departure' | 'post-stay';

interface JourneyTouchpoint {
  id: string;
  phase: JourneyPhase;
  title: string;
  description: string;
  status: TouchpointStatus;
  category: string;
  icon: React.ElementType;
  occurredAt: Date;
  details?: string;
  amount?: string;
  location?: string;
}

interface PhaseConfig {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
}

// =====================================================
// PHASE CONFIGURATION
// =====================================================

const phaseConfig: Record<JourneyPhase, PhaseConfig> = {
  'pre-arrival': {
    label: 'Pre-Arrival',
    description: 'Booking & preparation',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: CalendarCheck,
  },
  arrival: {
    label: 'Arrival',
    description: 'Check-in & welcome',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: LogIn,
  },
  'in-stay': {
    label: 'In-Stay',
    description: 'Services & experiences',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: Hotel,
  },
  departure: {
    label: 'Departure',
    description: 'Check-out & settlement',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: LogOut,
  },
  'post-stay': {
    label: 'Post-Stay',
    description: 'Feedback & retention',
    color: 'text-pink-700 dark:text-pink-300',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-200 dark:border-pink-800',
    icon: Heart,
  },
};

const phaseOrder: JourneyPhase[] = ['pre-arrival', 'arrival', 'in-stay', 'departure', 'post-stay'];

const statusConfig: Record<TouchpointStatus, { label: string; dotClass: string; badgeClass: string }> = {
  completed: {
    label: 'Completed',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  'in-progress': {
    label: 'In Progress',
    dotClass: 'bg-blue-500 animate-pulse',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  upcoming: {
    label: 'Upcoming',
    dotClass: 'bg-gray-400',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

// =====================================================
// CATEGORY COLORS
// =====================================================

const categoryColors: Record<string, string> = {
  Booking: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Communication: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  FrontDesk: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Housekeeping: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  Dining: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Spa: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  RoomService: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Billing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Transportation: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  Concierge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Loyalty: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Feedback: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  Security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Amenity: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Minibar: 'bg-wine-100 text-wine-700 dark:bg-wine-900/30 dark:text-wine-300',
  Maintenance: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  WiFi: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

// =====================================================
// RELATIVE TIME HELPER
// =====================================================

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =====================================================
// MOCK DATA
// =====================================================

function generateMockTouchpoints(guestName: string): JourneyTouchpoint[] {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  return [
    // Pre-Arrival
    {
      id: 'tp-1',
      phase: 'pre-arrival',
      title: 'Booking Created',
      description: `${guestName} booked a Deluxe Suite for 4 nights via the hotel website.`,
      status: 'completed',
      category: 'Booking',
      icon: CalendarCheck,
      occurredAt: daysAgo(12),
      details: 'Confirmation code: RS-2025-4821',
      amount: '₹48,000',
    },
    {
      id: 'tp-2',
      phase: 'pre-arrival',
      title: 'Booking Confirmation Sent',
      description: 'Automated confirmation email sent with booking details and payment receipt.',
      status: 'completed',
      category: 'Communication',
      icon: Mail,
      occurredAt: daysAgo(12),
      location: 'Email',
    },
    {
      id: 'tp-3',
      phase: 'pre-arrival',
      title: 'Pre-Arrival Welcome Email',
      description: 'Personalized welcome email sent with check-in instructions, local guide, and weather forecast.',
      status: 'completed',
      category: 'Communication',
      icon: Mail,
      occurredAt: daysAgo(3),
      location: 'Email',
    },
    {
      id: 'tp-4',
      phase: 'pre-arrival',
      title: 'Special Request Noted',
      description: 'Guest requested extra pillows and hypoallergenic bedding. Assigned to Room 302.',
      status: 'completed',
      category: 'Concierge',
      icon: Sparkles,
      occurredAt: daysAgo(2),
      location: 'Phone call',
    },
    {
      id: 'tp-5',
      phase: 'pre-arrival',
      title: 'Room Pre-Arrival Setup',
      description: 'Housekeeping configured room with extra pillows, allergen-free linens, and welcome turndown.',
      status: 'completed',
      category: 'Housekeeping',
      icon: Brush,
      occurredAt: daysAgo(1),
      location: 'Room 302',
    },
    {
      id: 'tp-6',
      phase: 'pre-arrival',
      title: 'Airport Transfer Confirmed',
      description: 'Private sedan booked from Bagdogra Airport for arrival transfer.',
      status: 'completed',
      category: 'Transportation',
      icon: Car,
      occurredAt: daysAgo(1),
      amount: '₹2,500',
    },

    // Arrival
    {
      id: 'tp-7',
      phase: 'arrival',
      title: 'Airport Pickup',
      description: 'Driver Raju met guest at arrivals with name board. Smooth 90-minute drive to property.',
      status: 'completed',
      category: 'Transportation',
      icon: Car,
      occurredAt: hoursAgo(72),
      location: 'Bagdogra Airport (IXB)',
    },
    {
      id: 'tp-8',
      phase: 'arrival',
      title: 'Check-In Completed',
      description: 'Express check-in processed. ID verified, ₹10,000 deposit collected.',
      status: 'completed',
      category: 'FrontDesk',
      icon: UserCheck,
      occurredAt: hoursAgo(70),
      location: 'Front Desk',
    },
    {
      id: 'tp-9',
      phase: 'arrival',
      title: 'Room Key Issued',
      description: 'Digital key card issued for Room 302 (Deluxe Suite, 3rd floor, mountain view).',
      status: 'completed',
      category: 'FrontDesk',
      icon: Key,
      occurredAt: hoursAgo(70),
      location: 'Room 302',
    },
    {
      id: 'tp-10',
      phase: 'arrival',
      title: 'Welcome Amenities Delivered',
      description: 'Complimentary fruit basket, Darjeeling tea set, and personalized welcome card from GM.',
      status: 'completed',
      category: 'Amenity',
      icon: Gift,
      occurredAt: hoursAgo(69),
      location: 'Room 302',
    },
    {
      id: 'tp-11',
      phase: 'arrival',
      title: 'WiFi Access Activated',
      description: 'Premium WiFi plan activated — guest connected to "RoyalStay-5G" network.',
      status: 'completed',
      category: 'WiFi',
      icon: Wifi,
      occurredAt: hoursAgo(70),
      location: 'Room 302',
    },
    {
      id: 'tp-12',
      phase: 'arrival',
      title: 'Luggage Delivered to Room',
      description: '3 pieces of luggage transported by bellboy to Room 302.',
      status: 'completed',
      category: 'Concierge',
      icon: Luggage,
      occurredAt: hoursAgo(69.5),
      location: 'Room 302',
    },

    // In-Stay
    {
      id: 'tp-13',
      phase: 'in-stay',
      title: 'Spa Booking: Hot Stone Massage',
      description: '90-minute hot stone therapy session booked for 2 guests at the Wellness Pavilion.',
      status: 'completed',
      category: 'Spa',
      icon: Sparkles,
      occurredAt: hoursAgo(65),
      amount: '₹4,500',
      location: 'Wellness Pavilion',
    },
    {
      id: 'tp-14',
      phase: 'in-stay',
      title: 'Dinner Reservation: The Everest Restaurant',
      description: 'Table for 2 reserved at 7:30 PM, window seat with mountain view.',
      status: 'completed',
      category: 'Dining',
      icon: UtensilsCrossed,
      occurredAt: hoursAgo(60),
      location: 'The Everest Restaurant',
    },
    {
      id: 'tp-15',
      phase: 'in-stay',
      title: 'Room Service Order',
      description: 'Late-night order: Darjeeling tea, croissants, and fruit platter.',
      status: 'completed',
      category: 'RoomService',
      icon: Coffee,
      occurredAt: hoursAgo(54),
      amount: '₹1,200',
      location: 'Room 302',
    },
    {
      id: 'tp-16',
      phase: 'in-stay',
      title: 'Housekeeping: Daily Turndown',
      description: 'Evening turndown service completed. Chocolate on pillow, curtains drawn.',
      status: 'completed',
      category: 'Housekeeping',
      icon: Brush,
      occurredAt: hoursAgo(48),
      location: 'Room 302',
    },
    {
      id: 'tp-17',
      phase: 'in-stay',
      title: 'Minibar Consumption',
      description: '2 premium beers and 1 bag of cashews consumed from in-room minibar.',
      status: 'completed',
      category: 'Minibar',
      icon: Wine,
      occurredAt: hoursAgo(44),
      amount: '₹850',
      location: 'Room 302',
    },
    {
      id: 'tp-18',
      phase: 'in-stay',
      title: 'Laundry Pickup',
      description: '4 garments collected for express laundry service (dry clean 2 suits, wash 2 shirts).',
      status: 'completed',
      category: 'Housekeeping',
      icon: Package,
      occurredAt: hoursAgo(36),
      amount: '₹2,400',
      location: 'Room 302',
    },
    {
      id: 'tp-19',
      phase: 'in-stay',
      title: 'Laundry Delivered',
      description: 'Express laundry returned. All garments pressed and hung in wardrobe.',
      status: 'completed',
      category: 'Housekeeping',
      icon: Package,
      occurredAt: hoursAgo(24),
      location: 'Room 302',
    },
    {
      id: 'tp-20',
      phase: 'in-stay',
      title: 'Concierge: Tiger Hill Sunrise Tour',
      description: 'Private jeep booked for 4:00 AM sunrise excursion to Tiger Hill viewpoint.',
      status: 'completed',
      category: 'Concierge',
      icon: MapPin,
      occurredAt: hoursAgo(30),
      amount: '₹3,000',
      location: 'Tiger Hill',
    },
    {
      id: 'tp-21',
      phase: 'in-stay',
      title: 'Maintenance Request: AC',
      description: 'Guest reported AC making unusual noise. Technician dispatched and repaired.',
      status: 'completed',
      category: 'Maintenance',
      icon: Stethoscope,
      occurredAt: hoursAgo(20),
      location: 'Room 302',
    },
    {
      id: 'tp-22',
      phase: 'in-stay',
      title: 'Room Service: Lunch',
      description: 'Grilled chicken salad, club sandwich, and fresh lime soda ordered.',
      status: 'completed',
      category: 'RoomService',
      icon: UtensilsCrossed,
      occurredAt: hoursAgo(16),
      amount: '₹2,100',
      location: 'Room 302',
    },
    {
      id: 'tp-23',
      phase: 'in-stay',
      title: 'Spa Session Completed',
      description: '90-minute hot stone massage completed. Guest rated 5/5 stars.',
      status: 'completed',
      category: 'Spa',
      icon: Sparkles,
      occurredAt: hoursAgo(10),
      location: 'Wellness Pavilion',
    },
    {
      id: 'tp-24',
      phase: 'in-stay',
      title: 'Loyalty Points Earned',
      description: '480 loyalty points credited for dining and spa spends during stay.',
      status: 'in-progress',
      category: 'Loyalty',
      icon: Award,
      occurredAt: hoursAgo(2),
    },

    // Departure
    {
      id: 'tp-25',
      phase: 'departure',
      title: 'Pre-Check-Out Folio Review',
      description: 'Guest reviewed folio via in-room TV. Total outstanding: ₹62,550.',
      status: 'upcoming',
      category: 'Billing',
      icon: FileText,
      occurredAt: daysFromNow(0.5),
    },
    {
      id: 'tp-26',
      phase: 'departure',
      title: 'Check-Out Processing',
      description: 'Express check-out to be processed. Deposit of ₹10,000 to be refunded.',
      status: 'upcoming',
      category: 'FrontDesk',
      icon: LogOut,
      occurredAt: daysFromNow(1),
    },
    {
      id: 'tp-27',
      phase: 'departure',
      title: 'Folio Settlement',
      description: 'Payment via credit card (ending 4521). Final amount: ₹62,550.',
      status: 'upcoming',
      category: 'Billing',
      icon: CreditCard,
      occurredAt: daysFromNow(1),
      amount: '₹62,550',
    },
    {
      id: 'tp-28',
      phase: 'departure',
      title: 'Airport Transfer Scheduled',
      description: 'Private sedan to Bagdogra Airport for 2:00 PM departure flight.',
      status: 'upcoming',
      category: 'Transportation',
      icon: Car,
      occurredAt: daysFromNow(1),
      amount: '₹2,500',
    },

    // Post-Stay
    {
      id: 'tp-29',
      phase: 'post-stay',
      title: 'Thank-You Email Sent',
      description: 'Personalized thank-you email with stay summary and receipt attached.',
      status: 'upcoming',
      category: 'Communication',
      icon: Mail,
      occurredAt: daysFromNow(1.5),
    },
    {
      id: 'tp-30',
      phase: 'post-stay',
      title: 'Feedback Survey Requested',
      description: 'Guest satisfaction survey link sent via email and SMS.',
      status: 'upcoming',
      category: 'Feedback',
      icon: MessageSquare,
      occurredAt: daysFromNow(2),
    },
    {
      id: 'tp-31',
      phase: 'post-stay',
      title: 'Loyalty Points Final Crediting',
      description: 'Remaining 320 loyalty points to be credited based on total folio.',
      status: 'upcoming',
      category: 'Loyalty',
      icon: Award,
      occurredAt: daysFromNow(3),
    },
    {
      id: 'tp-32',
      phase: 'post-stay',
      title: 'Follow-Up Email',
      description: 'Personalized follow-up with special return offer: 15% off next booking.',
      status: 'upcoming',
      category: 'Communication',
      icon: Mail,
      occurredAt: daysFromNow(7),
    },
  ];
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
}

// =====================================================
// PHASE HEADER
// =====================================================

function PhaseHeader({ config, eventCount, visibleCount }: { config: PhaseConfig; eventCount: number; visibleCount: number }) {
  const PhaseIcon = config.icon;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn('p-2 rounded-xl', config.bgColor)}>
        <PhaseIcon className={cn('h-5 w-5', config.color)} />
      </div>
      <div>
        <h3 className="text-base font-semibold">{config.label}</h3>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>
      <Badge variant="secondary" className="ml-auto text-xs">
        {visibleCount} / {eventCount}
      </Badge>
    </div>
  );
}

// =====================================================
// TOUCHPOINT ITEM
// =====================================================

function TouchpointItem({ touchpoint }: { touchpoint: JourneyTouchpoint }) {
  const Icon = touchpoint.icon;
  const statusInfo = statusConfig[touchpoint.status];
  const catColor = categoryColors[touchpoint.category] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <div className="relative flex gap-4 group">
      {/* Timeline connector + dot */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center z-10 border-2 border-background shadow-sm shrink-0',
          statusInfo.dotClass,
        )}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Content card */}
      <Card className={cn(
        'flex-1 mb-3 overflow-hidden hover:shadow-md transition-all duration-200 cursor-default',
        touchpoint.status === 'upcoming' && 'opacity-60 hover:opacity-80',
        touchpoint.status === 'in-progress' && 'ring-2 ring-blue-200 dark:ring-blue-800',
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            {/* Top row: badges + time */}
            <div className="flex items-center flex-wrap gap-2">
              <Badge variant="secondary" className={cn('text-[10px] font-medium', catColor)}>
                {touchpoint.category}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', statusInfo.badgeClass)}>
                {statusInfo.label}
              </Badge>
              <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getRelativeTime(touchpoint.occurredAt)}
              </span>
            </div>

            {/* Title + description */}
            <div>
              <h4 className="font-medium text-sm leading-tight">{touchpoint.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {touchpoint.description}
              </p>
            </div>

            {/* Meta details row */}
            {(touchpoint.details || touchpoint.amount || touchpoint.location) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {touchpoint.details && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {touchpoint.details}
                  </span>
                )}
                {touchpoint.amount && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <CreditCard className="h-3 w-3" />
                    {touchpoint.amount}
                  </span>
                )}
                {touchpoint.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {touchpoint.location}
                  </span>
                )}
                <span className="text-muted-foreground/70">
                  {formatAbsoluteDate(touchpoint.occurredAt)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

interface GuestJourneyMapProps {
  guestId?: string;
}

export function GuestJourneyMap({ guestId }: GuestJourneyMapProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<JourneyPhase | 'all'>('all');
  const PREVIEW_COUNT = 5;

  // Use mock data (can be swapped for real API when available)
  const allTouchpoints = useMemo(() => generateMockTouchpoints('Arjun Mehta'), []);

  // Group by phase
  const touchpointsByPhase = useMemo(() => {
    const grouped: Record<JourneyPhase, JourneyTouchpoint[]> = {
      'pre-arrival': [],
      arrival: [],
      'in-stay': [],
      departure: [],
      'post-stay': [],
    };
    allTouchpoints.forEach((tp) => {
      grouped[tp.phase].push(tp);
    });
    return grouped;
  }, [allTouchpoints]);

  // Filter by phase
  const filteredPhases = useMemo(() => {
    if (activeFilter === 'all') return phaseOrder;
    return [activeFilter];
  }, [activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const completed = allTouchpoints.filter(t => t.status === 'completed').length;
    const inProgress = allTouchpoints.filter(t => t.status === 'in-progress').length;
    const upcoming = allTouchpoints.filter(t => t.status === 'upcoming').length;
    const totalAmount = allTouchpoints
      .filter(t => t.amount && t.status === 'completed')
      .reduce((sum, t) => {
        const num = parseFloat(t.amount!.replace(/[^0-9.]/g, ''));
        return sum + num;
      }, 0);
    const uniqueCategories = [...new Set(allTouchpoints.map(t => t.category))];
    return { completed, inProgress, upcoming, totalAmount, uniqueCategories };
  }, [allTouchpoints]);

  // Flatten and filter all touchpoints
  const flatFiltered = useMemo(() => {
    const all: JourneyTouchpoint[] = [];
    filteredPhases.forEach(phase => {
      all.push(...touchpointsByPhase[phase]);
    });
    return all;
  }, [filteredPhases, touchpointsByPhase]);

  // Determine what to show in collapsed vs expanded mode
  const displayItems = useMemo(() => {
    if (expanded) return flatFiltered;
    // In collapsed mode, show the most recent PREVIEW_COUNT items
    // But always show at least the completed and in-progress items first
    const important = flatFiltered.filter(t => t.status !== 'upcoming');
    const rest = flatFiltered.filter(t => t.status === 'upcoming');
    const combined = [...important, ...rest];
    return combined.slice(0, PREVIEW_COUNT);
  }, [flatFiltered, expanded]);

  // For phase headers, figure out which phases have visible items
  const phasesWithVisibleItems = useMemo(() => {
    const visibleIds = new Set(displayItems.map(t => t.id));
    return phaseOrder.filter(phase =>
      touchpointsByPhase[phase].some(t => visibleIds.has(t.id))
    );
  }, [displayItems, touchpointsByPhase]);

  const hiddenCount = flatFiltered.length - displayItems.length;
  const showExpandButton = hiddenCount > 0 || expanded;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Route className="h-6 w-6" />
            Guest Journey Map
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete timeline of guest interactions and touchpoints across the stay lifecycle
          </p>
        </div>
        {guestId && (
          <Badge variant="outline" className="text-xs self-start">
            Guest ID: {guestId}
          </Badge>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={CalendarCheck}
          label="Total Touchpoints"
          value={String(allTouchpoints.length)}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          icon={Flag}
          label="Completed"
          value={String(stats.completed)}
          color="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={String(stats.inProgress)}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          icon={CreditCard}
          label="Revenue"
          value={`₹${stats.totalAmount.toLocaleString()}`}
          color="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          icon={TrendingUp}
          label="Categories"
          value={String(stats.uniqueCategories.length)}
          color="bg-violet-100 dark:bg-violet-900/30"
        />
      </div>

      {/* Journey Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Stay Lifecycle Progress</span>
            <span className="text-xs text-muted-foreground">
              {stats.completed + stats.inProgress} of {allTouchpoints.length} touchpoints
            </span>
          </div>
          <div className="flex gap-1.5">
            {phaseOrder.map((phase, index) => {
              const config = phaseConfig[phase];
              const phaseItems = touchpointsByPhase[phase];
              const hasCompleted = phaseItems.some(t => t.status === 'completed');
              const hasInProgress = phaseItems.some(t => t.status === 'in-progress');
              const isActive = hasInProgress;
              const isCompleted = hasCompleted && !hasInProgress;

              return (
                <div key={phase} className="flex items-center flex-1">
                  <button
                    onClick={() => setActiveFilter(activeFilter === phase ? 'all' : phase)}
                    className="flex flex-col items-center flex-1 gap-1 group"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all',
                      isCompleted
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : isActive
                          ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 animate-pulse'
                          : activeFilter === phase
                            ? `border-current ${config.color} ${config.bgColor}`
                            : 'bg-muted text-muted-foreground border-muted'
                    )}>
                      {isCompleted ? (
                        <span className="text-white text-xs">✓</span>
                      ) : (
                        <config.icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span className={cn(
                      'text-[10px] text-center leading-tight transition-colors',
                      isCompleted || isActive || activeFilter === phase
                        ? config.color
                        : 'text-muted-foreground'
                    )}>
                      {config.label}
                    </span>
                  </button>
                  {index < phaseOrder.length - 1 && (
                    <div className={cn(
                      'h-0.5 flex-1 min-w-4 mb-4',
                      isCompleted ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-muted'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phase Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('all')}
        >
          All Phases
        </Button>
        {phaseOrder.map(phase => {
          const config = phaseConfig[phase];
          const count = touchpointsByPhase[phase].length;
          const Icon = config.icon;
          return (
            <Button
              key={phase}
              variant={activeFilter === phase ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setActiveFilter(activeFilter === phase ? 'all' : phase)}
            >
              <Icon className="h-3.5 w-3.5" />
              {config.label}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Timeline */}
      <Card>
        <ScrollArea className="max-h-[700px]">
          <div className="p-6 space-y-6">
            {phasesWithVisibleItems.map((phase, phaseIndex) => {
              const config = phaseConfig[phase];
              const phaseItems = touchpointsByPhase[phase];
              const visibleIds = new Set(displayItems.map(t => t.id));
              const visiblePhaseItems = phaseItems.filter(t => visibleIds.has(t.id));

              if (visiblePhaseItems.length === 0) return null;

              return (
                <div key={phase}>
                  {/* Phase separator for all-but-first */}
                  {phaseIndex > 0 && <Separator className="mb-4" />}

                  {/* Phase header */}
                  <PhaseHeader
                    config={config}
                    eventCount={phaseItems.length}
                    visibleCount={visiblePhaseItems.length}
                  />

                  {/* Vertical timeline line + items */}
                  <div className="relative ml-4 mt-3">
                    <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-border" />
                    <div className="space-y-0">
                      {visiblePhaseItems.map((tp) => (
                        <TouchpointItem key={tp.id} touchpoint={tp} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Expand/Collapse button */}
            {showExpandButton && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show All ({hiddenCount} more touchpoints)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Category Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Category Legend</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(allTouchpoints.map(t => t.category))].map(cat => (
              <Badge
                key={cat}
                variant="secondary"
                className={cn('text-[10px]', categoryColors[cat] || 'bg-gray-100 text-gray-700')}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GuestJourneyMap;
