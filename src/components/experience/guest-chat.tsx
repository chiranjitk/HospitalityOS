'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  Paperclip,
  Phone,
  Mail,
  MoreVertical,
  Search,
  Loader2,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUIStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'file';
  data: string;
  size: number;
}

interface ChatMessage {
  id: string;
  content: string;
  senderType: string;
  senderId?: string;
  sender?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  messageType: string;
  sentAt: string;
  status: string;
}

interface Conversation {
  id: string;
  guestId?: string;
  bookingId?: string;
  channel: string;
  status: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  booking?: {
    confirmationCode: string;
    room?: { number: string };
  };
  messages?: ChatMessage[];
}

const channelIcons: Record<string, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  email: 'Email',
  ota: 'OTA',
};

const channelColors: Record<string, string> = {
  app: 'bg-emerald-500',
  whatsapp: 'bg-green-500',
  email: 'bg-amber-500',
  ota: 'bg-cyan-500',
};

export default function GuestChat() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    totalUnread: 0,
  });
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('tenantId', user?.tenantId || '');
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/chat-conversations?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setConversations(result.data);
        setStats(result.stats);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/chat-conversations/${conversationId}/messages`);
      const result = await response.json();

      if (result.success) {
        setMessages(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [toast]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  // Handle file attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 5MB limit`, variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const isImage = /^image\/(jpeg|png|gif|webp)$/i.test(file.type);
        const isPdf = file.type === 'application/pdf';
        setPendingAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          type: isImage ? 'image' : isPdf ? 'pdf' : 'file',
          data: base64,
          size: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Send message
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && pendingAttachments.length === 0) || !selectedConversation) return;

    setIsSending(true);
    try {
      const payload: Record<string, unknown> = {
        content: messageInput || '[Attachment]',
        senderType: 'staff',
        messageType: 'text',
      };
      if (pendingAttachments.length > 0) {
        payload.attachments = pendingAttachments;
      }

      const response = await fetch(`/api/chat-conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageInput,
          senderType: 'staff',
          messageType: 'text',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [...prev, result.data]);
        setMessageInput('');
        setPendingAttachments([]);
        // Update conversation's last message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: messageInput, lastMessageAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        throw new Error(result.error?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Guest Chat
            {stats.totalUnread > 0 && (
              <Badge className="ml-2 bg-red-500">{stats.totalUnread}</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Communicate with guests across multiple channels
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchConversations()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MessageSquare className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Conversations</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <MessageSquare className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.open}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <MessageSquare className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalUnread}</div>
              <div className="text-xs text-muted-foreground">Unread</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Phone className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{new Set(conversations.map(c => c.channel)).size}</div>
              <div className="text-xs text-muted-foreground">Channels</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px] sm:h-[500px] lg:h-[600px]">
        {/* Conversation List */}
        <Card className="lg:col-span-1">
          <CardHeader className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] sm:h-[400px] lg:h-[500px]">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4" />
                  <p>No conversations found</p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      'p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors',
                      selectedConversation?.id === conversation.id && 'bg-muted'
                    )}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conversation.guest?.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                          {conversation.guest?.firstName?.[0]}{conversation.guest?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            {conversation.guest?.firstName} {conversation.guest?.lastName}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessage || 'No messages yet'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn('text-xs text-white', channelColors[conversation.channel])}
                          >
                            {channelIcons[conversation.channel]}
                          </Badge>
                          {conversation.booking?.room && (
                            <span className="text-xs text-muted-foreground">
                              Room {conversation.booking.room.number}
                            </span>
                          )}
                          {conversation.lastMessageAt && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.guest?.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                        {selectedConversation.guest?.firstName?.[0]}{selectedConversation.guest?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {selectedConversation.guest?.firstName} {selectedConversation.guest?.lastName}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={cn('text-xs text-white', channelColors[selectedConversation.channel])}
                        >
                          {channelIcons[selectedConversation.channel]}
                        </Badge>
                        {selectedConversation.booking?.room && (
                          <span>Room {selectedConversation.booking.room.number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" title="Call guest" onClick={() => {
                      const phone = selectedConversation.guest?.phone;
                      if (phone) { window.open(`tel:${phone}`); }
                      else { toast({ title: 'No phone number', description: 'This guest has no phone number on file', variant: 'destructive' }); }
                    }}>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Email guest" onClick={() => {
                      const email = selectedConversation.guest?.email;
                      if (email) { window.open(`mailto:${email}`); }
                      else { toast({ title: 'No email address', description: 'This guest has no email on file', variant: 'destructive' }); }
                    }}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Guest options" onClick={() => {
                      useUIStore.getState().setActiveSection('guests-list');
                    }}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex',
                          message.senderType === 'guest' ? 'justify-start' : 'justify-end'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg p-3',
                            message.senderType === 'guest'
                              ? 'bg-muted'
                              : 'bg-emerald-500 text-white'
                          )}
                        >
                          {message.senderType === 'staff' && message.sender && (
                            <p className="text-xs opacity-70 mb-1">
                              {message.sender.firstName} {message.sender.lastName}
                            </p>
                          )}
                          <p>{message.content}</p>
                          {(message as Record<string, unknown>).attachments && Array.isArray((message as Record<string, unknown>).attachments) && (message as Record<string, unknown>).attachments!.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {((message as Record<string, unknown>).attachments! as Array<Record<string, unknown>>).map((att: Record<string, unknown>, i: number) => (
                                <div key={i} className="relative">
                                  {att.type === 'image' ? (
                                    <img src={att.data as string} alt={att.name as string} className="max-h-32 rounded-lg object-cover cursor-pointer" onClick={() => window.open(att.data as string, '_blank')} />
                                  ) : (
                                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2 cursor-pointer hover:bg-muted/80" onClick={() => window.open(att.data as string, '_blank')}>
                                      <FileText className="h-5 w-5 text-red-500 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs truncate max-w-[120px]">{att.name as string}</p>
                                        <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size as number)}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className={cn(
                            'text-xs mt-1',
                            message.senderType === 'guest' ? 'text-muted-foreground' : 'text-white/70'
                          )}>
                            {format(new Date(message.sentAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button variant="ghost" size="icon" title="Attach file" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  {pendingAttachments.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[180px]">
                      {pendingAttachments.map(att => (
                        <div key={att.id} className="relative shrink-0">
                          {att.type === 'image' ? (
                            <img src={att.data} alt={att.name} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-red-500" />
                            </div>
                          )}
                          <button
                            className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-[8px]"
                            onClick={() => removeAttachment(att.id)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={isSending || (!messageInput.trim() && pendingAttachments.length === 0)}>
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list to start chatting</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
