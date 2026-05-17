'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Inbox,
  Search,
  Filter,
  Send,
  Reply,
  Mail,
  MailOpen,
  Globe,
  Calendar,
  Paperclip,
  ChevronLeft,
  Star,
  MoreHorizontal,
} from 'lucide-react';

interface OTAMessage {
  id: string;
  guestName: string;
  otaSource: string;
  otaColor: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  thread: OTAThreadMessage[];
}

interface OTAThreadMessage {
  id: string;
  sender: 'guest' | 'hotel';
  text: string;
  time: string;
}

const messages: OTAMessage[] = [
  {
    id: '1',
    guestName: 'John Peters',
    otaSource: 'Booking.com',
    otaColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    subject: 'Early check-in request',
    preview: 'Hi, I arriving early at 10 AM. Can I check in early?',
    timestamp: '10 min ago',
    read: false,
    thread: [
      { id: 't1a', sender: 'guest', text: 'Hi, I arriving early at 10 AM on Friday. Can I check in early or store my luggage?', time: '9:30 AM' },
      { id: 't1b', sender: 'hotel', text: 'Hello John! We can store your luggage and we will try to have your room ready by noon. I will send you a confirmation.', time: '9:45 AM' },
      { id: 't1c', sender: 'guest', text: 'That would be great, thank you! My booking reference is BC-78291.', time: '10:00 AM' },
    ],
  },
  {
    id: '2',
    guestName: 'Maria Garcia',
    otaSource: 'Airbnb',
    otaColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
    subject: 'WiFi password please',
    preview: 'Could you send me the WiFi details for the apartment?',
    timestamp: '25 min ago',
    read: false,
    thread: [
      { id: 't2a', sender: 'guest', text: 'Hi! Could you send me the WiFi details for the apartment? Also, is there parking available?', time: '9:15 AM' },
    ],
  },
  {
    id: '3',
    guestName: 'Thomas Schmidt',
    otaSource: 'Expedia',
    otaColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    subject: 'Airport transfer inquiry',
    preview: 'Do you offer airport pickup service? How much does it cost?',
    timestamp: '1 hr ago',
    read: true,
    thread: [
      { id: 't3a', sender: 'guest', text: 'Do you offer airport pickup service? How much does it cost from the international terminal?', time: '8:30 AM' },
      { id: 't3b', sender: 'hotel', text: 'Hello Thomas! Yes, we offer airport pickup for $35 one way. Please share your flight details and we will arrange it.', time: '8:50 AM' },
      { id: 't3c', sender: 'guest', text: 'Perfect. My flight is LH401 arriving at 3:45 PM on Saturday.', time: '9:00 AM' },
      { id: 't3d', sender: 'hotel', text: 'Noted! Your driver will be at the arrivals hall with a sign. Confirmation sent to your email.', time: '9:10 AM' },
    ],
  },
  {
    id: '4',
    guestName: 'Aisha Khan',
    otaSource: 'Booking.com',
    otaColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    subject: 'Room change request',
    preview: 'Can I upgrade to a room with a sea view?',
    timestamp: '2 hrs ago',
    read: true,
    thread: [
      { id: 't4a', sender: 'guest', text: 'Can I upgrade to a room with a sea view? Happy to pay the difference.', time: '7:30 AM' },
      { id: 't4b', sender: 'hotel', text: 'Hi Aisha! We have a deluxe sea view available for an additional $40/night. Shall I arrange the upgrade?', time: '7:45 AM' },
    ],
  },
  {
    id: '5',
    guestName: 'David Lee',
    otaSource: 'VRBO',
    otaColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    subject: 'Late checkout possible?',
    preview: 'Our flight is at 8 PM. Can we check out at 4 PM instead?',
    timestamp: '3 hrs ago',
    read: true,
    thread: [
      { id: 't5a', sender: 'guest', text: 'Our flight is at 8 PM. Can we check out at 4 PM instead of noon?', time: '6:30 AM' },
      { id: 't5b', sender: 'hotel', text: 'Hi David, late checkout until 2 PM is complimentary. For 4 PM, there is a $30 half-day charge.', time: '7:00 AM' },
      { id: 't5c', sender: 'guest', text: '2 PM works great, thank you!', time: '7:15 AM' },
    ],
  },
  {
    id: '6',
    guestName: 'Sophie Dubois',
    otaSource: 'Hotels.com',
    otaColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    subject: 'Special dietary requirements',
    preview: 'I have a gluten allergy. Can the restaurant accommodate?',
    timestamp: '4 hrs ago',
    read: false,
    thread: [
      { id: 't6a', sender: 'guest', text: 'I have a gluten allergy. Can the restaurant accommodate? Also, is breakfast included in my rate?', time: '5:30 AM' },
    ],
  },
  {
    id: '7',
    guestName: 'Carlos Rivera',
    otaSource: 'Airbnb',
    otaColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
    subject: 'Directions to property',
    preview: 'Hi, can you send detailed directions from the train station?',
    timestamp: '5 hrs ago',
    read: true,
    thread: [
      { id: 't7a', sender: 'guest', text: 'Hi, can you send detailed directions from the central train station?', time: '4:30 AM' },
      { id: 't7b', sender: 'hotel', text: 'Hi Carlos! From the central station, take tram line 3 towards Harbor for 6 stops. We are 2 minutes walk from the Harbor stop. I will send a map to your email.', time: '5:00 AM' },
    ],
  },
  {
    id: '8',
    guestName: 'Emma Wilson',
    otaSource: 'TripAdvisor',
    otaColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    subject: 'Spa reservation',
    preview: 'I would like to book a couples massage for Sunday afternoon.',
    timestamp: '6 hrs ago',
    read: true,
    thread: [
      { id: 't8a', sender: 'guest', text: 'I would like to book a couples massage for Sunday afternoon. What times are available?', time: '3:30 AM' },
      { id: 't8b', sender: 'hotel', text: 'Hello Emma! We have availability at 2:00 PM and 4:00 PM on Sunday. The couples package is 90 minutes for $280.', time: '4:00 AM' },
      { id: 't8c', sender: 'guest', text: '4:00 PM sounds perfect! Please go ahead and book it.', time: '4:15 AM' },
      { id: 't8d', sender: 'hotel', text: 'Booked! Your couples massage is confirmed for Sunday at 4:00 PM. See you at the spa reception.', time: '4:30 AM' },
    ],
  },
  {
    id: '9',
    guestName: 'Yuki Nakamura',
    otaSource: 'Agoda',
    otaColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    subject: 'Cancellation policy question',
    preview: 'What is the cancellation policy for my non-refundable booking?',
    timestamp: '8 hrs ago',
    read: true,
    thread: [
      { id: 't9a', sender: 'guest', text: 'What is the cancellation policy for my non-refundable booking? A family emergency came up.', time: '1:30 AM' },
      { id: 't9b', sender: 'hotel', text: 'Hi Yuki, I am sorry to hear about your situation. Non-refundable bookings cannot be cancelled for a full refund, but we can offer a credit for a future stay. Please contact us directly for assistance.', time: '2:00 AM' },
    ],
  },
];

export default function OTAMessages() {
  const [selectedMessage, setSelectedMessage] = useState<OTAMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [otaFilter, setOtaFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const filteredMessages = messages.filter((m) => {
    if (otaFilter !== 'all' && m.otaSource !== otaFilter) return false;
    if (readFilter === 'unread' && m.read) return false;
    if (readFilter === 'read' && !m.read) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.guestName.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  const otaSources = [...new Set(messages.map((m) => m.otaSource))];

  const handleSelectMessage = (msg: OTAMessage) => {
    setSelectedMessage(msg);
    setReplyText('');
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedMessage) return;
    setReplyText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            OTA Messages
          </h2>
          <p className="text-muted-foreground">
            Manage guest communications from all OTA channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
            {unreadCount} unread
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={otaFilter} onValueChange={setOtaFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All OTAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {otaSources.map((src) => (
              <SelectItem key={src} value={src}>{src}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Messages Grid */}
      <div className="grid gap-6 lg:grid-cols-5 min-h-[600px]">
        {/* Message List */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {filteredMessages.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">No messages found</p>
                </div>
              ) : (
                <div>
                  {filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedMessage?.id === msg.id ? 'bg-teal-50 dark:bg-teal-950/30' : ''
                      } ${!msg.read ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {!msg.read && (
                            <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                          )}
                          <span className={`text-sm ${!msg.read ? 'font-semibold' : 'font-medium'}`}>
                            {msg.guestName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{msg.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${msg.otaColor} text-xs`}>{msg.otaSource}</Badge>
                        <span className="text-sm font-medium truncate">{msg.subject}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{msg.preview}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="border-0 shadow-sm lg:col-span-3">
          {selectedMessage ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSelectedMessage(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{selectedMessage.subject}</h3>
                      <Badge className={`${selectedMessage.otaColor} shrink-0`}>{selectedMessage.otaSource}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{selectedMessage.guestName}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {selectedMessage.timestamp}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <div className="p-4 space-y-4">
                    {selectedMessage.thread.map((threadMsg) => (
                      <div
                        key={threadMsg.id}
                        className={`flex ${threadMsg.sender === 'guest' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            threadMsg.sender === 'guest'
                              ? 'bg-muted'
                              : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white'
                          }`}
                        >
                          <p className="text-sm">{threadMsg.text}</p>
                          <p className={`text-xs mt-1 ${
                            threadMsg.sender === 'guest'
                              ? 'text-muted-foreground'
                              : 'text-teal-100'
                          }`}>
                            {threadMsg.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply Area */}
                <div className="p-4 border-t">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${selectedMessage.guestName}...`}
                        rows={3}
                        className="resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Globe className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!replyText.trim()) return;
                              setReplyText('');
                            }}
                          >
                            <Reply className="h-4 w-4 mr-1" />
                            Internal Note
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
                            onClick={handleReply}
                            disabled={!replyText.trim()}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center h-[600px]">
              <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Select a message to view details</p>
              <p className="text-xs text-muted-foreground mt-1">
                {unreadCount} unread messages waiting for your response
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
