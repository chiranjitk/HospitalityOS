'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2, Bot, Send, User, Lightbulb, Sparkles, Copy, ThumbsUp, ThumbsDown, Plus,
  MessageSquare, Trash2, PanelLeftClose, PanelLeft, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

const suggestedPrompts = [
  "What's my occupancy rate for this weekend?",
  "Show me guests checking in today",
  "Any rooms that need attention?",
  "Generate a revenue summary for this month",
  "Which guests have special requests today?",
  "What are the top performing room types?",
];

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

function SimpleMarkdown({ content }: { content: string }) {
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>)/s, '<ul class="list-disc">$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

const WELCOME_MESSAGE: Omit<Message, 'id'> = {
  role: 'assistant',
  content: "Hello! I'm your AI Copilot for StaySuite. I can help you with:\n\n• **Booking Management**: Search bookings, check availability, modify reservations\n• **Guest Services**: Guest lookup, preferences, special requests\n• **Operations**: Room status, housekeeping tasks, maintenance alerts\n• **Analytics**: Revenue reports, occupancy trends, performance metrics\n\nHow can I assist you today?",
  timestamp: new Date(),
  suggestions: suggestedPrompts.slice(0, 3),
};

export default function AICopilot() {
  const t = useTranslations('ai');
  const [messages, setMessages] = useState<Message[]>([
    { ...WELCOME_MESSAGE, id: '1' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    try {
      setConversationsLoading(true);
      const response = await fetch('/api/ai/conversations?limit=50');
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  // Load conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchConversationHistory = useCallback(async (conversationId: string) => {
    try {
      setLoadingConversation(true);
      const response = await fetch(`/api/ai/conversations/${conversationId}`);
      const data = await response.json();
      if (data.success && data.conversation) {
        const conv = data.conversation;
        const historyMessages: Message[] = conv.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));

        // If conversation has no messages, add the welcome message
        if (historyMessages.length === 0) {
          historyMessages.push({ ...WELCOME_MESSAGE, id: 'welcome' });
        }

        setMessages(historyMessages);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const handleNewChat = () => {
    setMessages([{ ...WELCOME_MESSAGE, id: Date.now().toString() }]);
    setCurrentConversationId(null);
    setInput('');
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/ai/conversations?id=${conversationId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          handleNewChat();
        }
        toast.success('Conversation deleted');
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string, convId: string | null) => {
    try {
      const response = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          role,
          content,
        }),
      });
      const data = await response.json();
      if (data.success) {
        // Update current conversation ID if new
        if (!convId && data.conversation) {
          setCurrentConversationId(data.conversation.id);
          fetchConversations(); // Refresh sidebar
        }
        return data.conversation?.id || convId;
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
    return convId;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setLoading(true);

    // Save user message
    const convId = await saveMessage('user', messageText, currentConversationId);

    try {
      // Call the real AI API
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: 'user', content: messageText }
          ]),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date(data.data.timestamp),
          suggestions: generateSuggestions(messageText),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Save assistant message
        await saveMessage('assistant', data.data.message, convId);
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('Error calling AI API:', error);
      toast.error('Failed to get AI response. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (userInput: string): string[] => {
    const input = userInput.toLowerCase();
    if (input.includes('occupancy') || input.includes('room')) {
      return ["Show available rooms", "View booking trends", "Check room status"];
    } else if (input.includes('check') && input.includes('in')) {
      return ["Send reminder to pending guests", "View VIP guest details", "Start check-in process"];
    } else if (input.includes('revenue')) {
      return ["View detailed breakdown", "Compare with last month", "Export report"];
    } else {
      return ["Show more details", "Export this data", "Take action"];
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleFeedback = async (messageId: string, positive: boolean) => {
    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          positive,
        }),
      });
      if (response.ok) {
        toast.success(positive ? 'Thanks for the feedback!' : 'Thanks for the feedback - we\'ll improve!');
      }
    } catch {
      toast.success(positive ? 'Thanks for the feedback!' : 'Thanks for the feedback - we\'ll improve!');
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Copilot</h2>
            <p className="text-muted-foreground">Your intelligent hospitality assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNewChat}>
            <Plus className="h-4 w-4 mr-1" />
            New Chat
          </Button>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI Powered
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 gap-4">
        {/* Sidebar - Conversation History */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 hidden md:block">
            <Card className="h-full border-0 shadow-sm flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversation History
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0">
                <ScrollArea className="h-full max-h-[calc(100vh-320px)]">
                  {conversationsLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No conversations yet
                    </div>
                  ) : (
                    <div className="space-y-0.5 px-2">
                      {conversations.map(conv => (
                        <button
                          key={conv.id}
                          className={`w-full text-left p-2.5 rounded-lg transition-colors hover:bg-muted/50 group ${
                            currentConversationId === conv.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => fetchConversationHistory(conv.id)}
                          disabled={loadingConversation}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{conv.title}</p>
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-sm">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {loadingConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                      >
                        {message.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                          <div
                            className={`rounded-lg p-4 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {message.role === 'assistant' ? (
                                <SimpleMarkdown content={message.content} />
                              ) : (
                                <span className="whitespace-pre-wrap">{message.content}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{message.timestamp.toLocaleTimeString()}</span>
                            {message.role === 'assistant' && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(message.content)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message.id, true)}>
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message.id, false)}>
                                  <ThumbsDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {message.suggestions && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {message.suggestions.map((suggestion, i) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleSuggestionClick(suggestion)}
                                >
                                  <Lightbulb className="h-3 w-3 mr-1" />
                                  {suggestion}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="rounded-lg p-4 bg-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask me anything about your hotel operations..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      className="flex-1"
                      disabled={loading || loadingConversation}
                    />
                    <Button onClick={handleSend} disabled={loading || loadingConversation || !input.trim()}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {suggestedPrompts.slice(0, 4).map((prompt, i) => (
                      <Button
                        key={i}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => handleSuggestionClick(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
