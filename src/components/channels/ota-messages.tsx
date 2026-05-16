'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageSquare,
  Send,
  Inbox,
  RefreshCw,
  Filter,
  Search,
  Clock,
  ExternalLink,
  ArrowLeft,
  Paperclip,
  ChevronDown,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// ============================================
// TYPES
// ============================================

interface OtaMessage {
  id: string;
  threadId: string;
  channel: string;
  guestName: string;
  guestEmail?: string;
  subject?: string;
  message: string;
  direction: 'inbound' | 'outbound';
  isRead: boolean;
  createdAt: string;
}

interface OtaThread {
  id: string;
  channel: string;
  channelLogo?: string;
  guestName: string;
  reservationId?: string;
  checkIn?: string;
  checkOut?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'open' | 'closed' | 'pending_reply';
}

// ============================================
// CONSTANTS & HELPERS
// ============================================

const CHANNEL_CONFIG: Record<string, { label: string; color: string; bgClass: string; badgeClass: string; icon: string }> = {
  'booking.com': {
    label: 'Booking.com',
    color: '#003580',
    bgClass: 'bg-[#003580]',
    badgeClass: 'bg-[#003580]/15 text-[#003580] dark:text-[#5b9bd5]',
    icon: 'B',
  },
  'airbnb': {
    label: 'Airbnb',
    color: '#FF5A5F',
    bgClass: 'bg-[#FF5A5F]',
    badgeClass: 'bg-[#FF5A5F]/15 text-[#FF5A5F] dark:text-[#ff8a8d]',
    icon: 'A',
  },
  'expedia': {
    label: 'Expedia',
    color: '#1B3B6F',
    bgClass: 'bg-[#1B3B6F]',
    badgeClass: 'bg-[#1B3B6F]/15 text-[#1B3B6F] dark:text-[#7b9fd4]',
    icon: 'E',
  },
  'vrbo': {
    label: 'Vrbo',
    color: '#3D5A99',
    bgClass: 'bg-[#3D5A99]',
    badgeClass: 'bg-[#3D5A99]/15 text-[#3D5A99] dark:text-[#8ba3d0]',
    icon: 'V',
  },
  'agoda': {
    label: 'Agoda',
    color: '#6B2D8B',
    bgClass: 'bg-[#6B2D8B]',
    badgeClass: 'bg-[#6B2D8B]/15 text-[#6B2D8B] dark:text-[#b07dd4]',
    icon: 'Ag',
  },
  'makemytrip': {
    label: 'MakeMyTrip',
    color: '#E4181C',
    bgClass: 'bg-[#E4181C]',
    badgeClass: 'bg-[#E4181C]/15 text-[#E4181C] dark:text-[#f07070]',
    icon: 'M',
  },
  'tripadvisor': {
    label: 'TripAdvisor',
    color: '#34E0A1',
    bgClass: 'bg-[#34E0A1]',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    icon: 'T',
  },
  'google_hotels': {
    label: 'Google Hotels',
    color: '#4285F4',
    bgClass: 'bg-[#4285F4]',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    icon: 'G',
  },
};

const DEFAULT_CHANNEL = {
  label: 'Unknown',
  color: '#64748B',
  bgClass: 'bg-slate-500',
  badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  icon: '?',
};

function getChannelConfig(channel: string) {
  return CHANNEL_CONFIG[channel] || DEFAULT_CHANNEL;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return (
        <Badge variant="success" className="text-[10px] px-1.5 py-0">
          Open
        </Badge>
      );
    case 'pending_reply':
      return (
        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
          Pending
        </Badge>
      );
    case 'closed':
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Closed
        </Badge>
      );
    default:
      return null;
  }
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_THREADS: OtaThread[] = [
  {
    id: 'thread-1',
    channel: 'booking.com',
    guestName: 'Sarah Johnson',
    reservationId: 'RES-2024-001',
    checkIn: '2025-02-15',
    checkOut: '2025-02-18',
    lastMessage: 'Hi, can I request a late checkout on February 18th? Our flight is not until 6 PM.',
    lastMessageAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unreadCount: 2,
    status: 'open',
  },
  {
    id: 'thread-2',
    channel: 'airbnb',
    guestName: 'Marco Rossi',
    reservationId: 'RES-2024-002',
    checkIn: '2025-02-20',
    checkOut: '2025-02-25',
    lastMessage: 'Thank you for confirming the extra towels! Looking forward to our stay.',
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    unreadCount: 0,
    status: 'open',
  },
  {
    id: 'thread-3',
    channel: 'expedia',
    guestName: 'Emily Chen',
    reservationId: 'RES-2024-003',
    lastMessage: 'Is early check-in possible? We will be arriving around 10 AM.',
    lastMessageAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    unreadCount: 1,
    status: 'pending_reply',
  },
  {
    id: 'thread-4',
    channel: 'booking.com',
    guestName: 'James Wilson',
    reservationId: 'RES-2024-004',
    checkIn: '2025-02-12',
    checkOut: '2025-02-14',
    lastMessage: 'We had a wonderful stay. Thank you for the upgrade!',
    lastMessageAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    status: 'closed',
  },
  {
    id: 'thread-5',
    channel: 'agoda',
    guestName: 'Yuki Tanaka',
    reservationId: 'RES-2024-005',
    checkIn: '2025-03-01',
    checkOut: '2025-03-05',
    lastMessage: 'Do you provide airport shuttle service? If so, how much does it cost?',
    lastMessageAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    unreadCount: 1,
    status: 'pending_reply',
  },
  {
    id: 'thread-6',
    channel: 'airbnb',
    guestName: 'Sophie Laurent',
    reservationId: 'RES-2024-006',
    checkIn: '2025-02-22',
    checkOut: '2025-02-24',
    lastMessage: 'Is there parking available at the property? We are driving from Lyon.',
    lastMessageAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    unreadCount: 3,
    status: 'open',
  },
  {
    id: 'thread-7',
    channel: 'vrbo',
    guestName: 'David Miller',
    reservationId: 'RES-2024-007',
    checkIn: '2025-03-10',
    checkOut: '2025-03-17',
    lastMessage: 'We are a family of 6 - will the kitchen be fully equipped for cooking?',
    lastMessageAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    unreadCount: 1,
    status: 'open',
  },
  {
    id: 'thread-8',
    channel: 'makemytrip',
    guestName: 'Rajesh Patel',
    reservationId: 'RES-2024-008',
    checkIn: '2025-02-28',
    checkOut: '2025-03-02',
    lastMessage: 'Can you arrange a birthday cake for March 1st? It is my anniversary.',
    lastMessageAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    status: 'open',
  },
];

const MOCK_MESSAGES: Record<string, OtaMessage[]> = {
  'thread-1': [
    {
      id: 'msg-1-1',
      threadId: 'thread-1',
      channel: 'booking.com',
      guestName: 'Sarah Johnson',
      message: 'Hello, I have a reservation for February 15-18 (RES-2024-001). I wanted to check if there is a gym at the property.',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-1-2',
      threadId: 'thread-1',
      channel: 'booking.com',
      guestName: 'StaySuite Hotel',
      message: 'Dear Sarah, thank you for reaching out! Yes, we have a fully equipped fitness center open 24/7 for all our guests. It is located on the ground floor near the lobby. Looking forward to welcoming you!',
      direction: 'outbound',
      isRead: true,
      createdAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-1-3',
      threadId: 'thread-1',
      channel: 'booking.com',
      guestName: 'Sarah Johnson',
      message: 'That is great, thank you! Also, can I request a late checkout on February 18th? Our flight is not until 6 PM.',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-1-4',
      threadId: 'thread-1',
      channel: 'booking.com',
      guestName: 'Sarah Johnson',
      message: 'I am happy to pay an extra fee if needed.',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
  ],
  'thread-2': [
    {
      id: 'msg-2-1',
      threadId: 'thread-2',
      channel: 'airbnb',
      guestName: 'Marco Rossi',
      message: 'Ciao! We are very excited about our upcoming stay. Could we get extra towels and pillows for the sofa bed?',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-2-2',
      threadId: 'thread-2',
      channel: 'airbnb',
      guestName: 'StaySuite Hotel',
      message: 'Hi Marco! Of course, we have already added extra towels and pillows to your room setup. The sofa bed will also have fresh linens. Anything else you need?',
      direction: 'outbound',
      isRead: true,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-2-3',
      threadId: 'thread-2',
      channel: 'airbnb',
      guestName: 'Marco Rossi',
      message: 'Thank you for confirming the extra towels! Looking forward to our stay.',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
  ],
  'thread-3': [
    {
      id: 'msg-3-1',
      threadId: 'thread-3',
      channel: 'expedia',
      guestName: 'Emily Chen',
      message: 'Is early check-in possible? We will be arriving around 10 AM.',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
  ],
  'thread-4': [
    {
      id: 'msg-4-1',
      threadId: 'thread-4',
      channel: 'booking.com',
      guestName: 'James Wilson',
      message: 'Just checked in. The room looks lovely! Is there any chance we can get a room with a better view?',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-4-2',
      threadId: 'thread-4',
      channel: 'booking.com',
      guestName: 'StaySuite Hotel',
      message: 'Hello James! We are glad you like the room. We have an upgrade available to a room with ocean view at no additional charge. Shall we arrange the move for you?',
      direction: 'outbound',
      isRead: true,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 1800000).toISOString(),
    },
    {
      id: 'msg-4-3',
      threadId: 'thread-4',
      channel: 'booking.com',
      guestName: 'James Wilson',
      message: 'That would be wonderful! Thank you so much.',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 3600000).toISOString(),
    },
    {
      id: 'msg-4-4',
      threadId: 'thread-4',
      channel: 'booking.com',
      guestName: 'StaySuite Hotel',
      message: 'The upgrade is confirmed! A staff member will bring the new key card to your current room. Enjoy the rest of your stay!',
      direction: 'outbound',
      isRead: true,
      createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 5400000).toISOString(),
    },
    {
      id: 'msg-4-5',
      threadId: 'thread-4',
      channel: 'booking.com',
      guestName: 'James Wilson',
      message: 'We had a wonderful stay. Thank you for the upgrade!',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
  ],
  'thread-5': [
    {
      id: 'msg-5-1',
      threadId: 'thread-5',
      channel: 'agoda',
      guestName: 'Yuki Tanaka',
      message: 'Hello, I have a reservation for early March. Do you provide airport shuttle service? If so, how much does it cost?',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    },
  ],
  'thread-6': [
    {
      id: 'msg-6-1',
      threadId: 'thread-6',
      channel: 'airbnb',
      guestName: 'Sophie Laurent',
      message: 'Bonjour! We are arriving by car from Lyon. Is there parking available at the property?',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-6-2',
      threadId: 'thread-6',
      channel: 'airbnb',
      guestName: 'Sophie Laurent',
      message: 'Also, what are the nearby restaurants you would recommend?',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-6-3',
      threadId: 'thread-6',
      channel: 'airbnb',
      guestName: 'Sophie Laurent',
      message: 'And one more question - is there a washing machine in the apartment?',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    },
  ],
  'thread-7': [
    {
      id: 'msg-7-1',
      threadId: 'thread-7',
      channel: 'vrbo',
      guestName: 'David Miller',
      message: 'We are a family of 6 and I wanted to ask about the kitchen facilities. Will it be fully equipped for cooking? We plan to make some meals ourselves.',
      direction: 'inbound',
      isRead: false,
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ],
  'thread-8': [
    {
      id: 'msg-8-1',
      threadId: 'thread-8',
      channel: 'makemytrip',
      guestName: 'Rajesh Patel',
      message: 'Namaste! We are celebrating our wedding anniversary during our stay. Can you arrange a cake for March 1st?',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-8-2',
      threadId: 'thread-8',
      channel: 'makemytrip',
      guestName: 'StaySuite Hotel',
      message: 'Congratulations on your anniversary, Rajesh! We would be delighted to arrange a cake for you. Would you prefer chocolate or vanilla?',
      direction: 'outbound',
      isRead: true,
      createdAt: new Date(Date.now() - 2.5 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'msg-8-3',
      threadId: 'thread-8',
      channel: 'makemytrip',
      guestName: 'Rajesh Patel',
      message: 'Can you arrange a birthday cake for March 1st? It is my anniversary.',
      direction: 'inbound',
      isRead: true,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    },
  ],
};

// ============================================
// STANDALONE SUB-COMPONENTS
// ============================================

function ThreadListItem({
  thread,
  isSelected,
  onSelect,
}: {
  thread: OtaThread;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const channelConfig = getChannelConfig(thread.channel);

  return (
    <button
      onClick={() => onSelect(thread.id)}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-150 group',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'bg-muted dark:bg-muted/40',
        thread.unreadCount > 0 && 'bg-emerald-50/50 dark:bg-emerald-950/20',
      )}
    >
      {/* Channel avatar */}
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
          channelConfig.bgClass,
        )}
      >
        {channelConfig.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              thread.unreadCount > 0 ? 'font-semibold' : 'font-medium',
            )}
          >
            {thread.guestName}
          </span>
          <StatusBadge status={thread.status} />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 font-normal h-4', channelConfig.badgeClass)}
          >
            {channelConfig.label}
          </Badge>
          {thread.reservationId && (
            <span className="text-[10px] text-muted-foreground truncate">
              {thread.reservationId}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {thread.lastMessage}
        </p>

        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(thread.lastMessageAt)}
          </span>
        </div>
      </div>

      {/* Unread badge */}
      {thread.unreadCount > 0 && (
        <div className="flex-shrink-0 mt-1">
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5">
            {thread.unreadCount}
          </Badge>
        </div>
      )}
    </button>
  );
}

function MessageBubble({ message }: { message: OtaMessage }) {
  const isInbound = message.direction === 'inbound';
  const channelConfig = getChannelConfig(message.channel);

  return (
    <div className={cn('flex gap-2.5 max-w-[85%] sm:max-w-[75%]', isInbound ? '' : 'ml-auto flex-row-reverse')}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0 mt-auto">
        <AvatarFallback
          className={cn(
            'text-[10px] font-semibold',
            isInbound ? 'bg-muted' : channelConfig.bgClass + ' text-white',
          )}
        >
          {isInbound ? getInitials(message.guestName) : 'SS'}
        </AvatarFallback>
      </Avatar>

      {/* Bubble */}
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-medium', isInbound ? '' : 'text-right flex-1')}>
            {isInbound ? message.guestName : 'You'}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatMessageTime(message.createdAt)}
          </span>
          {!isInbound && (
            <CheckCheck className="h-3 w-3 text-emerald-500" />
          )}
        </div>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isInbound
              ? 'bg-muted dark:bg-muted/60 rounded-tl-md'
              : channelConfig.bgClass + ' text-white rounded-tr-md',
          )}
        >
          {message.message}
        </div>
      </div>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn('flex gap-3 max-w-[80%]', i % 2 === 0 ? '' : 'ml-auto flex-row-reverse')}>
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-2 w-56">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function OtaMessages() {
  const isMobile = useIsMobile();

  // State
  const [threads, setThreads] = useState<OtaThread[]>([]);
  const [messages, setMessages] = useState<OtaMessage[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Selected thread data
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  // Available channels from current threads
  const availableChannels = useMemo(() => {
    const channelSet = new Set(threads.map((t) => t.channel));
    return Array.from(channelSet);
  }, [threads]);

  // Filtered threads
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const matchesSearch =
        searchQuery === '' ||
        thread.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (thread.reservationId && thread.reservationId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesChannel = channelFilter === 'all' || thread.channel === channelFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unread' && thread.unreadCount > 0) ||
        (statusFilter === 'open' && thread.status === 'open') ||
        (statusFilter === 'pending_reply' && thread.status === 'pending_reply') ||
        (statusFilter === 'closed' && thread.status === 'closed');

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [threads, searchQuery, channelFilter, statusFilter]);

  // Sort threads: unread first, then by most recent
  const sortedThreads = useMemo(() => {
    return [...filteredThreads].sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [filteredThreads]);

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      if (statusFilter === 'unread') params.set('status', 'unread');

      const response = await fetch(`/api/channel-manager/messages?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch threads');

      const data = await response.json();

      if (data.success) {
        setThreads(data.data.threads || []);
        setTotalUnread(data.data.unread || 0);
      } else {
        // Fallback to mock data
        setThreads(MOCK_THREADS);
        setTotalUnread(MOCK_THREADS.reduce((sum, t) => sum + t.unreadCount, 0));
      }
    } catch {
      // Fallback to mock data
      setThreads(MOCK_THREADS);
      setTotalUnread(MOCK_THREADS.reduce((sum, t) => sum + t.unreadCount, 0));
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter]);

  // Fetch messages for a thread
  const fetchThreadMessages = useCallback(async (threadId: string) => {
    setThreadLoading(true);
    try {
      const response = await fetch(`/api/channel-manager/messages/threads/${threadId}`);
      if (!response.ok) throw new Error('Failed to fetch thread');

      const data = await response.json();

      if (data.success) {
        setMessages(data.data.messages || []);
      } else {
        setMessages(MOCK_MESSAGES[threadId] || []);
      }
    } catch {
      setMessages(MOCK_MESSAGES[threadId] || []);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle thread selection
  const handleSelectThread = useCallback(
    (threadId: string) => {
      setSelectedThreadId(threadId);
      setReplyText('');
      fetchThreadMessages(threadId);
    },
    [fetchThreadMessages],
  );

  // Handle back (mobile)
  const handleBack = useCallback(() => {
    setSelectedThreadId(null);
    setMessages([]);
    setReplyText('');
  }, []);

  // Handle send reply
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !selectedThreadId) return;

    setSendingReply(true);
    try {
      const response = await fetch(`/api/channel-manager/messages/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });

      if (!response.ok) throw new Error('Failed to send reply');

      const result = await response.json();

      if (result.success) {
        toast.success('Reply sent successfully');
        setReplyText('');
        // Optimistically add the sent message
        const optimisticMsg: OtaMessage = {
          id: `msg-${Date.now()}`,
          threadId: selectedThreadId,
          channel: selectedThread?.channel || 'booking.com',
          guestName: 'StaySuite Hotel',
          message: replyText.trim(),
          direction: 'outbound',
          isRead: true,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        fetchThreads();
      } else {
        toast.error('Failed to send reply. Please try again.');
      }
    } catch {
      toast.error('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
      replyInputRef.current?.focus();
    }
  }, [replyText, selectedThreadId, selectedThread, fetchThreads]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchThreads();
    if (selectedThreadId) {
      fetchThreadMessages(selectedThreadId);
    }
    toast.success('Messages refreshed');
  }, [fetchThreads, fetchThreadMessages, selectedThreadId]);

  // Channel config for the selected thread
  const selectedChannelConfig = selectedThread ? getChannelConfig(selectedThread.channel) : null;

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className="overflow-hidden h-full">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span>OTA Messages</span>
              {totalUnread > 0 && (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] ml-2 px-1.5 py-0 h-4 min-w-4">
                  {totalUnread}
                </Badge>
              )}
            </div>
          </CardTitle>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="inbox" className="text-xs px-3 h-7 gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                Inbox
              </TabsTrigger>
              <TabsTrigger value="starred" className="text-xs px-3 h-7 gap-1.5">
                <StarIcon className="h-3.5 w-3.5" />
                Starred
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ========== INBOX TAB ========== */}
          <TabsContent value="inbox" className="mt-0 h-full">
            <div className="flex h-[calc(100vh-280px)] sm:h-[calc(100vh-240px)] md:h-[calc(100vh-220px)]">
              {/* LEFT PANEL: Thread list */}
              <div
                className={cn(
                  'flex flex-col border-r w-full md:w-[360px] lg:w-[400px] flex-shrink-0 bg-background',
                  isMobile && selectedThreadId ? 'hidden' : 'flex',
                )}
              >
                {/* Thread list header */}
                <div className="p-4 space-y-3 border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <h2 className="text-lg font-semibold">Messages</h2>
                    </div>
                    <div className="flex items-center gap-1">
                      {totalUnread > 0 && (
                        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-semibold">
                          {totalUnread} new
                        </Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleRefresh}
                            disabled={loading}
                          >
                            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh messages</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search guests, messages, reservations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    {/* Channel filter dropdown */}
                    <div className="relative flex-1">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="w-full flex items-center gap-2 h-8 pl-9 pr-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        <span className="truncate">
                          {channelFilter === 'all'
                            ? 'All Channels'
                            : getChannelConfig(channelFilter).label}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 ml-auto flex-shrink-0" />
                      </button>

                      {showFilterDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                          <div className="absolute top-full left-0 mt-1 z-50 w-full min-w-[180px] rounded-md border bg-popover p-1 shadow-md">
                            <button
                              onClick={() => { setChannelFilter('all'); setShowFilterDropdown(false); }}
                              className={cn(
                                'w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors',
                                channelFilter === 'all' && 'bg-muted font-medium',
                              )}
                            >
                              All Channels
                            </button>
                            {availableChannels.map((ch) => {
                              const config = getChannelConfig(ch);
                              return (
                                <button
                                  key={ch}
                                  onClick={() => { setChannelFilter(ch); setShowFilterDropdown(false); }}
                                  className={cn(
                                    'w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors flex items-center gap-2',
                                    channelFilter === ch && 'bg-muted font-medium',
                                  )}
                                >
                                  <div className={cn('h-4 w-4 rounded-full flex items-center justify-center text-[8px] text-white flex-shrink-0', config.bgClass)}>
                                    {config.icon}
                                  </div>
                                  {config.label}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Status filter */}
                    <div className="flex rounded-md border overflow-hidden">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'unread', label: 'Unread' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStatusFilter(opt.value)}
                          className={cn(
                            'px-3 py-1.5 text-xs font-medium transition-colors',
                            statusFilter === opt.value
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Thread count */}
                <div className="px-4 py-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {sortedThreads.length} conversation{sortedThreads.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Thread list content */}
                <ScrollArea className="flex-1">
                  {loading ? (
                    <ThreadListSkeleton />
                  ) : sortedThreads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">No messages found</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {searchQuery || channelFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'Messages from your OTA channels will appear here'}
                      </p>
                    </div>
                  ) : (
                    <div className="px-2 space-y-0.5">
                      {sortedThreads.map((thread) => (
                        <ThreadListItem
                          key={thread.id}
                          thread={thread}
                          isSelected={selectedThreadId === thread.id}
                          onSelect={handleSelectThread}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* RIGHT PANEL: Thread view */}
              <div
                className={cn(
                  'flex-1 min-w-0 bg-background',
                  isMobile && !selectedThreadId ? 'hidden' : 'flex',
                )}
              >
                <div className="flex-1">
                  {!selectedThread ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <h3 className="text-base font-medium text-muted-foreground">Select a conversation</h3>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Choose a message thread from the list to view the conversation
                      </p>
                    </div>
                  ) : (
                    /* Thread detail */
                    <div className="flex flex-col h-full">
                      {/* Thread header */}
                      <div className="p-4 border-b flex-shrink-0">
                        <div className="flex items-center gap-3">
                          {isMobile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 -ml-1 flex-shrink-0"
                              onClick={handleBack}
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Channel avatar */}
                          <div
                            className={cn(
                              'h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                              selectedChannelConfig!.bgClass,
                            )}
                          >
                            {selectedChannelConfig!.icon}
                          </div>

                          {/* Guest info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm truncate">{selectedThread.guestName}</h3>
                              <StatusBadge status={selectedThread.status} />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-1.5 py-0 h-4 font-normal', selectedChannelConfig!.badgeClass)}
                              >
                                {selectedChannelConfig!.label}
                              </Badge>
                              {selectedThread.reservationId && (
                                <span className="truncate">{selectedThread.reservationId}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {selectedThread.checkIn && selectedThread.checkOut && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {new Date(selectedThread.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {' - '}
                                      {new Date(selectedThread.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Stay dates</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View in {selectedChannelConfig!.label}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <ScrollArea className="flex-1">
                        {threadLoading ? (
                          <ThreadViewSkeleton />
                        ) : (
                          <div className="p-4 space-y-4">
                            {/* Date separator */}
                            {messages.length > 0 && (
                              <div className="flex items-center gap-3 py-2">
                                <Separator className="flex-1" />
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                  {new Date(messages[0].createdAt).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                                <Separator className="flex-1" />
                              </div>
                            )}

                            {messages.map((msg) => (
                              <MessageBubble key={msg.id} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </ScrollArea>

                      {/* Reply bar */}
                      <div className="p-3 border-t bg-background flex-shrink-0">
                        {/* Mobile stay dates */}
                        {selectedThread.checkIn && selectedThread.checkOut && (
                          <div className="sm:hidden flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 px-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(selectedThread.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' - '}
                              {new Date(selectedThread.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <Input
                              ref={replyInputRef}
                              placeholder={`Reply to ${selectedThread.guestName} via ${selectedChannelConfig!.label}...`}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendReply();
                                }
                              }}
                              className="pr-10 h-10"
                              disabled={sendingReply}
                            />
                            <Paperclip className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer" />
                          </div>
                          <Button
                            size="icon"
                            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || sendingReply}
                          >
                            {sendingReply ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Reply channel indicator */}
                        <div className="flex items-center justify-between mt-1.5 px-1">
                          <p className="text-[10px] text-muted-foreground">
                            Reply will be sent via{' '}
                            <span className="font-medium">{selectedChannelConfig!.label}</span>
                            {selectedThread.status === 'pending_reply' && (
                              <Badge variant="warning" className="ml-1.5 text-[9px] px-1 py-0">
                                Awaiting your reply
                              </Badge>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ========== STARRED TAB ========== */}
          <TabsContent value="starred" className="mt-0 h-full">
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <StarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-base font-medium text-muted-foreground">Starred Messages</h3>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                  Star important conversations to quickly access them later
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============================================
// STAR ICON HELPER
// ============================================

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
