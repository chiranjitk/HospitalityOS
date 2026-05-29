'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Clock,
  LogOut,
  ArrowRightLeft,
  Shield,
  Gift,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpCircle,
  CreditCard,
  Timer,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  confirmationCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomRate: number;
  currency: string;
  totalAmount: number;
  primaryGuest: { id: string; firstName: string; lastName: string; loyaltyTier?: string; isVip?: boolean };
  room?: { id: string; number: string };
  roomType: { id: string; name: string; code: string; basePrice: number };
  property: { id: string; name: string };
  depositRequired?: boolean;
  depositPaid?: boolean;
  depositAmount?: number;
  depositDeadline?: string;
}

interface RoomOption {
  id: string;
  number: string;
  floor?: number;
  roomTypeId: string;
  roomType: { id: string; name: string; basePrice: number };
  status: string;
  amenities?: string;
}

interface UpgradeOffer {
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  description: string | null;
  currentPricePerNight: number;
  upgradePricePerNight: number;
  priceDifference: number;
  priceDifferencePerNight: number;
  nights: number;
  availableRooms: number;
  amenitiesGained: string[];
  images: string[];
  valueScore: number;
  currency: string;
}

interface CrossSellOffer {
  type: string;
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
}

interface EarlyCheckinRequest {
  id: string;
  bookingId: string;
  requestedTime: string;
  feeAmount: number;
  feeStatus: string;
  status: string;
  reason: string | null;
  booking?: { confirmationCode: string; roomType: { name: string } };
  guest?: { firstName: string; lastName: string; loyaltyTier: string; isVip: boolean };
}

interface LateCheckoutRequest {
  id: string;
  bookingId: string;
  requestedUntil: string;
  feeAmount: number;
  feeStatus: string;
  status: string;
  loyaltyWaived: boolean;
  reason: string | null;
  booking?: { confirmationCode: string; roomType: { name: string } };
  guest?: { firstName: string; lastName: string; loyaltyTier: string };
}

// ─── Component ───────────────────────────────────────────────────────────

interface BookingActionsProps {
  booking: Booking;
  onActionComplete?: () => void;
}

export default function BookingActions({ booking, onActionComplete }: BookingActionsProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([]);
  const [upgradeOffers, setUpgradeOffers] = useState<UpgradeOffer[]>([]);
  const [crossSellOffers, setCrossSellOffers] = useState<CrossSellOffer[]>([]);
  const [guaranteeStats, setGuaranteeStats] = useState<Record<string, number>>({});

  // Form states
  const [earlyCheckinTime, setEarlyCheckinTime] = useState('');
  const [earlyCheckinReason, setEarlyCheckinReason] = useState('');
  const [lateCheckoutTime, setLateCheckoutTime] = useState('');
  const [lateCheckoutReason, setLateCheckoutReason] = useState('');
  const [roomMoveTarget, setRoomMoveTarget] = useState('');
  const [roomMoveReason, setRoomMoveReason] = useState('guest_request');
  const [roomMoveNotes, setRoomMoveNotes] = useState('');
  const [guaranteePaid, setGuaranteePaid] = useState(false);
  const [earlyCheckoutDate, setEarlyCheckoutDate] = useState('');
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  const [isSubmittingEarlyCheckout, setIsSubmittingEarlyCheckout] = useState(false);

  const canCheckIn = booking.status === 'confirmed';
  const canCheckOut = booking.status === 'checked_in';

  // ─── Early Checkin ─────────────────────────────────────────────────
  const handleEarlyCheckin = async () => {
    if (!earlyCheckinTime) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings/early-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          requestedTime: earlyCheckinTime,
          reason: earlyCheckinReason,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.data.autoApproved ? 'Early check-in auto-approved!' : 'Early check-in request submitted' });
        setActiveDialog(null);
        onActionComplete?.();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  // ─── Late Checkout ─────────────────────────────────────────────────
  const handleLateCheckout = async () => {
    if (!lateCheckoutTime) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings/late-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          requestedUntil: lateCheckoutTime,
          reason: lateCheckoutReason,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: result.data.autoApproved ? 'Late check-out auto-approved!' : 'Late check-out request submitted' });
        setActiveDialog(null);
        onActionComplete?.();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  // ─── Room Move ────────────────────────────────────────────────────
  const handleRoomMove = async () => {
    if (!roomMoveTarget || !booking.room) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings/room-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          fromRoomId: booking.room.id,
          toRoomId: roomMoveTarget,
          reason: roomMoveReason,
          notes: roomMoveNotes,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Room Moved', description: `Guest moved to Room ${result.data.roomNumber}` });
        setActiveDialog(null);
        onActionComplete?.();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  // ─── Fetch available rooms for room move ──────────────────────────
  const fetchAvailableRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?propertyId=${booking.property.id}&status=available`);
      const result = await res.json();
      if (result.success) setAvailableRooms(result.data || []);
    } catch { /* ignore */ }
  }, [booking.property.id]);

  // ─── Fetch upgrade offers ─────────────────────────────────────────
  const fetchUpgradeOffers = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/upgrade-offers?bookingId=${booking.id}`);
      const result = await res.json();
      if (result.success) {
        setUpgradeOffers(result.data.upgradeOffers || []);
        setCrossSellOffers(result.data.crossSellOffers || []);
      }
    } catch { /* ignore */ }
  }, [booking.id]);

  // ─── Guarantee update ─────────────────────────────────────────────
  const handleGuaranteeUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings/guarantees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          depositPaid: guaranteePaid,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Guarantee Updated', description: guaranteePaid ? 'Deposit marked as paid' : 'Deposit marked as unpaid' });
        setActiveDialog(null);
        onActionComplete?.();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  // Open dialog with data fetch
  const openDialog = (dialogId: string) => {
    setActiveDialog(dialogId);
    if (dialogId === 'room-move') fetchAvailableRooms();
    if (dialogId === 'upgrade') fetchUpgradeOffers();
  };

  const actionButtons = [
    ...(canCheckIn ? [{ id: 'early-checkin', label: 'Early Check-In', icon: Clock, color: 'text-emerald-600' }] : []),
    ...(canCheckOut ? [
      { id: 'late-checkout', label: 'Late Check-Out', icon: Timer, color: 'text-amber-600' },
      { id: 'room-move', label: 'Room Move', icon: ArrowRightLeft, color: 'text-blue-600' },
      { id: 'early-checkout', label: 'Early Check-Out', icon: LogOut, color: 'text-orange-600' },
      { id: 'upgrade', label: 'Upgrade', icon: ArrowUpCircle, color: 'text-purple-600' },
    ] : []),
    ...(booking.depositRequired ? [{ id: 'guarantee', label: 'Guarantee', icon: Shield, color: 'text-rose-600' }] : []),
    ...(canCheckOut ? [{ id: 'upgrade', label: 'Upgrade', icon: Gift, color: 'text-violet-600' }] : []),
  ];

  // Deduplicate
  const uniqueActions = actionButtons.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {uniqueActions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            onClick={() => openDialog(action.id)}
            className={cn('h-7 text-xs gap-1', action.color)}
          >
            <action.icon className="h-3 w-3" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* ─── Early Check-In Dialog ─────────────────────────────────── */}
      <Dialog open={activeDialog === 'early-checkin'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-emerald-500" /> Request Early Check-In</DialogTitle>
            <DialogDescription>
              For {booking.primaryGuest.firstName} {booking.primaryGuest.lastName} — {booking.confirmationCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Requested Check-In Time</Label>
              <Input type="datetime-local" value={earlyCheckinTime} onChange={(e) => setEarlyCheckinTime(e.target.value)} />
              <p className="text-xs text-muted-foreground">Standard check-in is typically 3:00 PM. Fee may apply for early arrival.</p>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Flight arrival time, special occasion..." value={earlyCheckinReason} onChange={(e) => setEarlyCheckinReason(e.target.value)} rows={2} />
            </div>
            {booking.primaryGuest.loyaltyTier && ['gold', 'platinum', 'diamond'].includes(booking.primaryGuest.loyaltyTier?.toLowerCase() || '') && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm">
                <span className="font-medium">Loyalty Benefit:</span> Fee auto-waived for {booking.primaryGuest.loyaltyTier} tier guests
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button onClick={handleEarlyCheckin} disabled={isLoading || !earlyCheckinTime}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Late Check-Out Dialog ─────────────────────────────────── */}
      <Dialog open={activeDialog === 'late-checkout'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-amber-500" /> Request Late Check-Out</DialogTitle>
            <DialogDescription>
              For {booking.primaryGuest.firstName} {booking.primaryGuest.lastName} — {booking.confirmationCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Requested Check-Out Time</Label>
              <Input type="datetime-local" value={lateCheckoutTime} onChange={(e) => setLateCheckoutTime(e.target.value)} />
              <p className="text-xs text-muted-foreground">Standard check-out is typically 11:00 AM. Tiered fees apply.</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium">Fee Tiers:</p>
              <p>Until 2 PM — 25% of nightly rate</p>
              <p>Until 4 PM — 50% of nightly rate</p>
              <p>Until 6 PM — 75% of nightly rate</p>
              <p>After 6 PM — 100% (full night)</p>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Late flight, business meeting..." value={lateCheckoutReason} onChange={(e) => setLateCheckoutReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button onClick={handleLateCheckout} disabled={isLoading || !lateCheckoutTime}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Room Move Dialog ──────────────────────────────────────── */}
      <Dialog open={activeDialog === 'room-move'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-blue-500" /> Move Guest Room</DialogTitle>
            <DialogDescription>
              Current: Room {booking.room?.number || 'N/A'} ({booking.roomType.name})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Room</Label>
              {availableRooms.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading available rooms...
                </div>
              ) : (
                <Select value={roomMoveTarget} onValueChange={setRoomMoveTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available room" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms
                      .filter((r) => r.id !== booking.room?.id)
                      .map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          Room {room.number} — {room.roomType.name} ({formatCurrency(room.roomType.basePrice)}/night)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={roomMoveReason} onValueChange={setRoomMoveReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest_request">Guest Request</SelectItem>
                  <SelectItem value="maintenance">Maintenance Issue</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional details..." value={roomMoveNotes} onChange={(e) => setRoomMoveNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button onClick={handleRoomMove} disabled={isLoading || !roomMoveTarget}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Move Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Early Check-Out Request Dialog ────────────────────────── */}
      <Dialog open={activeDialog === 'early-checkout'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogOut className="h-5 w-5 text-orange-500" /> Request Early Check-Out</DialogTitle>
            <DialogDescription>
              For {booking.primaryGuest.firstName} {booking.primaryGuest.lastName} — {booking.confirmationCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm">
              <p className="font-medium">Current check-out: {new Date(booking.checkOut).toLocaleDateString()}</p>
              <p className="text-muted-foreground">Cancellation policy may apply. Refund will be calculated based on nights stayed.</p>
            </div>
            <div className="space-y-2">
              <Label>Requested Check-Out Date</Label>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                max={booking.checkOut.split('T')[0]}
                value={earlyCheckoutDate}
                onChange={(e) => setEarlyCheckoutDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Change of plans, early flight..."
                rows={2}
                value={earlyCheckoutReason}
                onChange={(e) => setEarlyCheckoutReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              disabled={!earlyCheckoutDate || isSubmittingEarlyCheckout}
              onClick={async () => {
                setIsSubmittingEarlyCheckout(true);
                try {
                  const res = await fetch('/api/bookings/early-checkout-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bookingId: booking.id,
                      requestedCheckoutDate: earlyCheckoutDate,
                      reason: earlyCheckoutReason,
                    }),
                  });
                  const result = await res.json();
                  if (result.success) {
                    toast({
                      title: 'Request Submitted',
                      description: 'Early checkout request has been submitted for review',
                    });
                    setActiveDialog(null);
                    setEarlyCheckoutDate('');
                    setEarlyCheckoutReason('');
                    onActionComplete?.();
                  } else {
                    toast({
                      title: 'Error',
                      description: result.error?.message || 'Failed to submit early checkout request',
                      variant: 'destructive',
                    });
                  }
                } catch {
                  toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
                } finally {
                  setIsSubmittingEarlyCheckout(false);
                }
              }}
            >
              {isSubmittingEarlyCheckout && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Upgrade Offers Dialog ─────────────────────────────────── */}
      <Dialog open={activeDialog === 'upgrade'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-violet-500" /> Upgrade & Add-On Offers</DialogTitle>
            <DialogDescription>
              For {booking.primaryGuest.firstName} {booking.primaryGuest.lastName} — Room {booking.room?.number || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="room-upgrade" className="flex-1 min-h-0">
            <TabsList className="w-full">
              <TabsTrigger value="room-upgrade" className="flex-1">Room Upgrades</TabsTrigger>
              <TabsTrigger value="add-ons" className="flex-1">Add-Ons</TabsTrigger>
            </TabsList>
            <TabsContent value="room-upgrade" className="mt-4">
              <ScrollArea className="max-h-[50vh]">
                {upgradeOffers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No upgrade offers available</p>
                    <p className="text-xs">All higher room types are occupied</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upgradeOffers.map((offer) => (
                      <Card key={offer.roomTypeId} className="hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{offer.roomTypeName}</h4>
                              <p className="text-xs text-muted-foreground">{offer.description || 'Premium room experience'}</p>
                              {offer.amenitiesGained.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {offer.amenitiesGained.slice(0, 4).map((a) => (
                                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                                  ))}
                                  {offer.amenitiesGained.length > 4 && (
                                    <Badge variant="outline" className="text-xs">+{offer.amenitiesGained.length - 4}</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">+{formatCurrency(offer.priceDifferencePerNight)}/night</p>
                              <p className="text-lg font-bold">{formatCurrency(offer.priceDifference)}</p>
                              <p className="text-xs text-muted-foreground">{offer.nights} night{offer.nights > 1 ? 's' : ''}</p>
                              <Badge variant="outline" className="mt-1 text-xs">{offer.availableRooms} room{offer.availableRooms !== 1 ? 's' : ''} available</Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            onClick={async () => {
                              const targetRoom = availableRooms.find((r) => r.roomTypeId === offer.roomTypeId);
                              if (!targetRoom) {
                                toast({ title: 'Info', description: 'Fetching room options...', variant: 'default' });
                                fetchAvailableRooms();
                                return;
                              }
                              setRoomMoveTarget(targetRoom.id);
                              setRoomMoveReason('upgrade');
                              toast({ title: 'Upgrade Selected', description: `Proceeding with ${offer.roomTypeName}` });
                              setActiveDialog(null);
                              setTimeout(() => openDialog('room-move'), 200);
                            }}
                          >
                            Upgrade Now <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="add-ons" className="mt-4">
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-3">
                  {crossSellOffers.map((offer) => (
                    <Card key={offer.id} className="hover:shadow-md transition-shadow border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{offer.name}</h4>
                            <p className="text-xs text-muted-foreground">{offer.description}</p>
                            <Badge variant="secondary" className="mt-1 text-xs capitalize">{offer.category}</Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(offer.price)}</p>
                            <Button size="sm" variant="outline" className="mt-1" onClick={() => toast({ title: 'Coming Soon', description: 'Add-on booking will be available soon' })}>
                              Add
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ─── Guarantee Dialog ──────────────────────────────────────── */}
      <Dialog open={activeDialog === 'guarantee'} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-rose-500" /> Deposit Guarantee</DialogTitle>
            <DialogDescription>
              Booking {booking.confirmationCode} — {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Deposit Amount</p>
                <p className="text-lg font-bold">{formatCurrency(booking.depositAmount || 0)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {booking.depositPaid ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">Paid</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600">
                        {booking.depositDeadline && new Date(booking.depositDeadline) < new Date() ? 'Overdue' : 'Pending'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {booking.depositDeadline && (
              <p className="text-xs text-muted-foreground">
                Deadline: {new Date(booking.depositDeadline).toLocaleDateString()} at {new Date(booking.depositDeadline).toLocaleTimeString()}
              </p>
            )}
            {!booking.depositPaid && (
              <div className="flex items-center gap-3">
                <Button
                  className={cn(guaranteePaid ? 'bg-emerald-600' : '')}
                  onClick={() => setGuaranteePaid(true)}
                  variant={guaranteePaid ? 'default' : 'outline'}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Paid
                </Button>
                <Button variant="outline" onClick={() => setGuaranteePaid(false)}>
                  <XCircle className="h-4 w-4 mr-1" /> Mark Unpaid
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Close</Button>
            <Button onClick={handleGuaranteeUpdate} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Standalone Management Panels ──────────────────────────────────────

/** Tab panel for viewing/managing all early check-in requests */
export function EarlyCheckinPanel() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<EarlyCheckinRequest[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/bookings/early-checkin');
        const result = await res.json();
        if (result.success) {
          setEntries(result.data || []);
          setStats(result.stats || {});
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    setApprovingId(id);
    try {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const res = await fetch('/api/bookings/early-checkin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Updated', description: `Request ${status}` });
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total || 0 },
          { label: 'Pending', value: stats.pending || 0, color: 'text-amber-600' },
          { label: 'Approved', value: stats.approved || 0, color: 'text-emerald-600' },
          { label: 'Fees Collected', value: stats.totalFeesCollected || 0, isCurrency: true },
        ].map((s) => (
          <Card key={s.label} className="p-3 border-0 shadow-sm">
            <p className={cn('text-xl font-bold', s.color)}>{s.isCurrency ? `$${s.value}` : s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No early check-in requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="p-3 border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {entry.guest?.firstName} {entry.guest?.lastName}
                    {entry.guest?.isVip && <Crown className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.booking?.confirmationCode} • Requested: {new Date(entry.requestedTime).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.status === 'approved' ? 'default' : entry.status === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                    {entry.status}
                  </Badge>
                  {entry.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={approvingId === entry.id} onClick={() => handleApprove(entry.id, 'approved')}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" disabled={approvingId === entry.id} onClick={() => handleApprove(entry.id, 'rejected')}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tab panel for viewing/managing all late check-out requests */
export function LateCheckoutPanel() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<LateCheckoutRequest[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/bookings/late-checkout');
        const result = await res.json();
        if (result.success) {
          setEntries(result.data || []);
          setStats(result.stats || {});
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleUpdate = async (id: string, status: 'approved' | 'rejected', waiveFee: boolean) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/bookings/late-checkout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, waiveFee }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Updated', description: `Late check-out ${status}` });
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setUpdatingId(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total || 0 },
          { label: 'Pending', value: stats.pending || 0, color: 'text-amber-600' },
          { label: 'Loyalty Waived', value: stats.loyaltyWaivedCount || 0, color: 'text-purple-600' },
          { label: 'Fees Collected', value: stats.totalFeesCollected || 0, isCurrency: true },
        ].map((s) => (
          <Card key={s.label} className="p-3 border-0 shadow-sm">
            <p className={cn('text-xl font-bold', s.color)}>{s.isCurrency ? `$${s.value}` : s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Timer className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No late check-out requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="p-3 border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{entry.guest?.firstName} {entry.guest?.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.booking?.confirmationCode} • Until: {new Date(entry.requestedUntil).toLocaleString()}
                    {entry.loyaltyWaived && <Badge variant="secondary" className="ml-2 text-xs">Fee Waived</Badge>}
                  </p>
                  <p className="text-xs font-medium mt-0.5">Fee: ${entry.feeAmount}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.status === 'approved' ? 'default' : entry.status === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                    {entry.status}
                  </Badge>
                  {entry.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updatingId === entry.id} onClick={() => handleUpdate(entry.id, 'approved', false)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updatingId === entry.id} onClick={() => handleUpdate(entry.id, 'approved', true)}>
                        Waive Fee
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" disabled={updatingId === entry.id} onClick={() => handleUpdate(entry.id, 'rejected', false)}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tab panel for viewing/managing deposit guarantees */
export function GuaranteesPanel() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [enforcing, setEnforcing] = useState(false);

  const fetchGuarantees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings/guarantees');
      const result = await res.json();
      if (result.success) {
        setBookings(result.data || []);
        setStats(result.stats || {});
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGuarantees(); }, []);

  const handleMarkPaid = async (bookingId: string) => {
    try {
      const res = await fetch('/api/bookings/guarantees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, depositPaid: true }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Marked as Paid' });
        fetchGuarantees();
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleAutoEnforce = async () => {
    if (!confirm('Cancel all overdue guarantee bookings?')) return;
    setEnforcing(true);
    try {
      const res = await fetch('/api/bookings/guarantees', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Enforcement Complete', description: result.message });
        fetchGuarantees();
      }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setEnforcing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
          {[
            { label: 'Total', value: stats.totalRequiringGuarantee || 0 },
            { label: 'Paid', value: stats.paid || 0, color: 'text-emerald-600' },
            { label: 'Pending', value: stats.pending || 0, color: 'text-blue-600' },
            { label: 'Overdue', value: stats.overdue || 0, color: 'text-red-600' },
            { label: 'Due Soon', value: stats.dueSoon || 0, color: 'text-amber-600' },
          ].map((s) => (
            <Card key={s.label} className="p-3 border-0 shadow-sm">
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
        <Button variant="destructive" size="sm" className="ml-3" onClick={handleAutoEnforce} disabled={enforcing}>
          {enforcing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Auto-Enforce
        </Button>
      </div>
      {bookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No bookings requiring guarantees</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Card key={b.id} className="p-3 border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{b.primaryGuest?.firstName} {b.primaryGuest?.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.confirmationCode} • {b.roomType?.name} • Deposit: ${b.depositAmount}
                  </p>
                  {b.depositDeadline && (
                    <p className="text-xs text-muted-foreground">Deadline: {new Date(b.depositDeadline).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    b.guaranteeStatus === 'paid' ? 'default' : b.guaranteeStatus === 'overdue' ? 'destructive' : b.guaranteeStatus === 'due_soon' ? 'secondary' : 'outline'
                  } className="text-xs">
                    {b.guaranteeStatus}
                  </Badge>
                  {!b.depositPaid && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkPaid(b.id)}>
                      <CreditCard className="h-3 w-3 mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Need Crown import for VIP badge
import { Crown } from 'lucide-react';
