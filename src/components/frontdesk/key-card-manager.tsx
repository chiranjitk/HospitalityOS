'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Power,
  PowerOff,
  Undo2,
  AlertTriangle,
  Clock,
  Building2,
  User,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface KeyCard {
  id: string;
  cardNumber: string;
  cardType: string;
  status: string;
  accessLevel: string;
  issuedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
  returnedAt: string | null;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
  issuerName: string | null;
  roomId: string;
  guestId: string | null;
  bookingId: string | null;
  room: { id: string; number: string; floor: number };
  property: { id: string; name: string };
}

interface KeyCardStats {
  total: number;
  issuedToday: number;
  active: number;
  deactivated: number;
  returned: number;
  lost: number;
  overdue: number;
}

interface RoomOption {
  id: string;
  number: string;
  floor: number;
  property: { id: string; name: string };
}

interface GuestOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  issued: { label: 'Issued', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <KeyRound className="h-3 w-3" /> },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <Power className="h-3 w-3" /> },
  deactivated: { label: 'Deactivated', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: <PowerOff className="h-3 w-3" /> },
  returned: { label: 'Returned', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300', icon: <Undo2 className="h-3 w-3" /> },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function KeyCardManager() {
  const { toast } = useToast();

  // Data states
  const [keyCards, setKeyCards] = useState<KeyCard[]>([]);
  const [stats, setStats] = useState<KeyCardStats | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyId, setPropertyId] = useState<string>('');

  // Dialog states
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedRoomForHistory, setSelectedRoomForHistory] = useState<RoomOption | null>(null);

  // Issue form
  const [issueForm, setIssueForm] = useState({
    roomId: '',
    guestId: '',
    cardType: 'physical',
    accessLevel: 'standard',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    notes: '',
  });

  const fetchKeyCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/key-cards?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch key cards');
      const result = await response.json();
      if (result.success) setKeyCards(result.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch key cards', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, propertyId, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/key-cards?stats=true${propertyId ? `&propertyId=${propertyId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const result = await response.json();
      if (result.success) setStats(result.data);
    } catch {
      // Stats are non-critical
    }
  }, [propertyId]);

  const fetchRooms = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('status', 'occupied');
      const response = await fetch(`/api/rooms?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch rooms');
      const result = await response.json();
      if (result.success) setRooms(result.data);
    } catch {
      // Non-critical
    }
  }, []);

  // Initial data load on mount
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchKeyCards();
    fetchStats();
    fetchRooms();
  });

  // Filter key cards by search query
  const filteredCards = keyCards.filter(card => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      card.cardNumber.toLowerCase().includes(q) ||
      card.room.number.toLowerCase().includes(q) ||
      card.property.name.toLowerCase().includes(q) ||
      (card.issuerName && card.issuerName.toLowerCase().includes(q))
    );
  });

  // Quick action: change card status
  const handleStatusChange = async (cardId: string, action: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/key-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, action }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to update key card');
      }
      toast({
        title: 'Key Card Updated',
        description: `Card status changed successfully`,
      });
      fetchKeyCards();
      fetchStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update key card';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Issue new key card
  const handleIssue = async () => {
    if (!issueForm.roomId) {
      toast({ title: 'Validation Error', description: 'Room is required', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/key-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: issueForm.roomId,
          guestId: issueForm.guestId || undefined,
          cardType: issueForm.cardType,
          accessLevel: issueForm.accessLevel,
          validFrom: issueForm.validFrom,
          validTo: issueForm.validTo || undefined,
          notes: issueForm.notes || undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to issue key card');
      }

      toast({ title: 'Key Card Issued', description: 'New key card has been issued successfully' });
      setIsIssueDialogOpen(false);
      setIssueForm({
        roomId: '',
        guestId: '',
        cardType: 'physical',
        accessLevel: 'standard',
        validFrom: new Date().toISOString().split('T')[0],
        validTo: '',
        notes: '',
      });
      fetchKeyCards();
      fetchStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to issue key card';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // View history for a room
  const viewRoomHistory = (room: RoomOption) => {
    setSelectedRoomForHistory(room);
    setIsHistoryDialogOpen(true);
  };

  // Search guests when a room is selected
  const prevRoomIdRef = React.useRef(issueForm.roomId);
  React.useEffect(() => {
    const currentRoomId = issueForm.roomId;
    if (currentRoomId === prevRoomIdRef.current) return;
    prevRoomIdRef.current = currentRoomId;

    if (!currentRoomId) {
      return;
    }

    const fetchGuestsForRoom = async () => {
      try {
        const response = await fetch(`/api/bookings?status=checked_in&roomId=${issueForm.roomId}`);
        if (!response.ok) return;
        const result = await response.json();
        if (result.success) {
          const uniqueGuests = result.data
            .map((b: { primaryGuest: GuestOption }) => b.primaryGuest)
            .filter((g: GuestOption, i: number, arr: GuestOption[]) => arr.findIndex(x => x.id === g.id) === i);
          setGuests(uniqueGuests);
        }
      } catch {
        // Non-critical
      }
    };

    fetchGuestsForRoom();
  }, [issueForm.roomId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Key Card Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Issue, track and manage guest key cards
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchKeyCards(); fetchStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsIssueDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Issue Card
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Issued Today', value: stats.issuedToday, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Active', value: stats.active, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Deactivated', value: stats.deactivated, color: 'text-gray-600 dark:text-gray-400' },
            { label: 'Returned', value: stats.returned, color: 'text-teal-600 dark:text-teal-400' },
            { label: 'Lost', value: stats.lost, color: 'text-red-600 dark:text-red-400' },
            { label: 'Overdue', value: stats.overdue, color: 'text-amber-600 dark:text-amber-400' },
          ].map(item => (
            <Card key={item.label} className="p-3">
              <div className={cn('text-2xl font-bold tabular-nums', item.color)}>{item.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by card number, room, issuer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deactivated">Deactivated</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Cards List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <KeyRound className="h-12 w-12 mb-4" />
            <p>No key cards found</p>
            <p className="text-sm">Issue a new key card to get started</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {filteredCards.map(card => {
              const config = statusConfig[card.status] || statusConfig.issued;
              const isOverdue = card.status === 'active' && card.validTo && new Date(card.validTo) < new Date();
              const allowedActions = getAvailableActions(card.status);

              return (
                <Card key={card.id} className={cn(
                  'transition-all',
                  isOverdue && 'border-amber-300 dark:border-amber-700'
                )}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Card Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                          <KeyRound className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">{card.cardNumber}</span>
                            <Badge className={cn('text-xs gap-1', config.color)}>
                              {config.icon}
                              {config.label}
                            </Badge>
                            {card.cardType !== 'physical' && (
                              <Badge variant="outline" className="text-xs">{card.cardType}</Badge>
                            )}
                            {card.accessLevel !== 'standard' && (
                              <Badge variant="outline" className="text-xs gap-1 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800">
                                <ShieldCheck className="h-3 w-3" />
                                {card.accessLevel}
                              </Badge>
                            )}
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                Room {card.room.number} (F{card.room.floor})
                              </span>
                              <span>{card.property.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Issued {formatDistanceToNow(new Date(card.issuedAt), { addSuffix: true })}
                              </span>
                              {card.issuerName && <span>by {card.issuerName}</span>}
                            </div>
                            {card.validTo && (
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Valid until {format(new Date(card.validTo), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {allowedActions.map(action => (
                          <Button
                            key={action.action}
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(card.id, action.action)}
                            disabled={isProcessing}
                            className={cn('text-xs gap-1', action.className)}
                          >
                            {action.icon}
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewRoomHistory(card.room)}
                          className="text-xs gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          History
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Issue Key Card Dialog */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Issue Key Card
            </DialogTitle>
            <DialogDescription>
              Create a new key card for room access
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Room Selection */}
            <div className="space-y-2">
              <Label>Room *</Label>
              <Select value={issueForm.roomId} onValueChange={(v) => setIssueForm(prev => ({ ...prev, roomId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      Room {room.number} (Floor {room.floor}) - {room.property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Guest Selection */}
            <div className="space-y-2">
              <Label>Guest (Optional)</Label>
              <Select value={issueForm.guestId} onValueChange={(v) => setIssueForm(prev => ({ ...prev, guestId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map(guest => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.firstName} {guest.lastName} {guest.email ? `(${guest.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {guests.length === 0 && issueForm.roomId && (
                <p className="text-xs text-muted-foreground">No active guests found for this room</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card Type */}
              <div className="space-y-2">
                <Label>Card Type</Label>
                <Select value={issueForm.cardType} onValueChange={(v) => setIssueForm(prev => ({ ...prev, cardType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Access Level */}
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select value={issueForm.accessLevel} onValueChange={(v) => setIssueForm(prev => ({ ...prev, accessLevel: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Valid From */}
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={issueForm.validFrom}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, validFrom: e.target.value }))}
                />
              </div>

              {/* Valid To */}
              <div className="space-y-2">
                <Label>Valid To (Optional)</Label>
                <Input
                  type="date"
                  value={issueForm.validTo}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, validTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional notes..."
                value={issueForm.notes}
                onChange={(e) => setIssueForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleIssue}
              disabled={isProcessing || !issueForm.roomId}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Issue Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Key Card History
            </DialogTitle>
            <DialogDescription>
              Room {selectedRoomForHistory?.number} (Floor {selectedRoomForHistory?.floor})
            </DialogDescription>
          </DialogHeader>

          <RoomHistoryTimeline roomId={selectedRoomForHistory?.id || ''} />

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper: get available actions for a status
function getAvailableActions(status: string) {
  const actions: Array<{ action: string; label: string; icon: React.ReactNode; className?: string }> = [];

  if (status === 'issued') {
    actions.push(
      { action: 'activate', label: 'Activate', icon: <Power className="h-3 w-3" />, className: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800' },
      { action: 'lose', label: 'Mark Lost', icon: <AlertTriangle className="h-3 w-3" />, className: 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800' },
    );
  } else if (status === 'active') {
    actions.push(
      { action: 'deactivate', label: 'Deactivate', icon: <ShieldX className="h-3 w-3" /> },
      { action: 'return', label: 'Returned', icon: <Undo2 className="h-3 w-3" />, className: 'text-teal-600 border-teal-200 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-800' },
      { action: 'lose', label: 'Mark Lost', icon: <AlertTriangle className="h-3 w-3" />, className: 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800' },
    );
  } else if (status === 'deactivated') {
    actions.push(
      { action: 'activate', label: 'Reactivate', icon: <RotateCcw className="h-3 w-3" />, className: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800' },
    );
  }

  return actions;
}

// Room History Timeline Component
function RoomHistoryTimeline({ roomId }: { roomId: string }) {
  const [cards, setCards] = useState<KeyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/key-cards?roomId=${roomId}`);
        if (!response.ok) throw new Error('Failed');
        const result = await response.json();
        if (result.success) setCards(result.data);
      } catch {
        // Non-critical
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [roomId]);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No key card history for this room</p>;
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-3 pr-2">
        {cards.map(card => {
          const config = statusConfig[card.status] || statusConfig.issued;
          return (
            <div key={card.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex flex-col items-center">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs', config.color)}>
                  {config.icon}
                </div>
                <div className="w-px h-full bg-border mt-1" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{card.cardNumber}</span>
                  <Badge className={cn('text-[10px] gap-0.5', config.color)}>{config.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  {card.issuerName && <p>Issued by {card.issuerName}</p>}
                  <p>Issued: {format(new Date(card.issuedAt), 'MMM d, yyyy HH:mm')}</p>
                  {card.activatedAt && <p>Activated: {format(new Date(card.activatedAt), 'MMM d, yyyy HH:mm')}</p>}
                  {card.returnedAt && <p>Returned: {format(new Date(card.returnedAt), 'MMM d, yyyy HH:mm')}</p>}
                  {card.deactivatedAt && <p>Deactivated: {format(new Date(card.deactivatedAt), 'MMM d, yyyy HH:mm')}</p>}
                  {card.notes && <p className="text-muted-foreground italic">{card.notes}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
