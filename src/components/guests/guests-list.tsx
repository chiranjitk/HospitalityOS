'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerDescription,
} from '@/components/ui/drawer';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Mail,
  Phone,
  Loader2,
  Eye,
  Hotel,
  DollarSign,
  Globe,
  X,
  Star,
  Send,
  MapPin,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';

// ─── Types ─────────────────────────────────────────────────────────────

interface ActiveBooking {
  id: string;
  confirmationCode: string;
  status: string;
  roomNumber: string | null;
  checkIn: string;
  checkOut: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  country?: string;
  city?: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
  vipLevel?: string;
  source: string;
  kycStatus: string;
  totalBookings: number;
  createdAt: string;
  activeBooking: ActiveBooking | null;
}

interface GuestsListProps {
  onSelectGuest?: (guestId: string) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────

const loyaltyTiers = [
  { value: 'bronze', label: 'Bronze', color: 'bg-gradient-to-r from-amber-700 to-amber-600', textColor: 'text-amber-200', avatarBg: 'from-amber-500 to-orange-600' },
  { value: 'silver', label: 'Silver', color: 'bg-gradient-to-r from-gray-400 to-gray-300', textColor: 'text-white', avatarBg: 'from-gray-400 to-gray-500' },
  { value: 'gold', label: 'Gold', color: 'bg-gradient-to-r from-yellow-500 to-amber-500', textColor: 'text-yellow-100', avatarBg: 'from-yellow-400 to-amber-600' },
  { value: 'platinum', label: 'Platinum', color: 'bg-gradient-to-r from-slate-400 to-gray-600', textColor: 'text-gray-100', avatarBg: 'from-slate-400 to-gray-600' },
];

const sources = [
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'walk_in', label: 'Walk-in' },
];

type QuickFilter = 'all' | 'vip' | 'in_house' | 'loyalty';

// ─── Animation variants ────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.2 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  exit: { opacity: 0, x: 12, transition: { duration: 0.15 } },
};

// ─── Main Component ────────────────────────────────────────────────────

export default function GuestsList({ onSelectGuest }: GuestsListProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const t = useTranslations('guests');

  // Responsive breakpoints
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1024px)');

  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    idType: '',
    idNumber: '',
    notes: '',
    loyaltyTier: 'bronze',
    isVip: false,
    vipLevel: '',
    source: 'direct',
  });

  // ─── Fetch ALL guests (no server-side filtering) ────────────────
  useEffect(() => {
    const abortController = new AbortController();

    setIsLoading(true);
    (async () => {
      try {
        const response = await fetch('/api/guests', { signal: abortController.signal });
        if (!response.ok) {
          const text = await response.text().catch(() => 'Unknown error');
          throw new Error(text);
        }
        const result = await response.json();
        if (result.success) setAllGuests(result.data);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        toast({
          title: 'Error',
          description: 'Failed to fetch guests',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    })();

    return () => abortController.abort();
  }, []);

  // ─── Client-side filtering ──────────────────────────────────────
  const filteredGuests = useMemo(() => {
    let result = allGuests;

    // Quick filter
    switch (activeFilter) {
      case 'vip':
        result = result.filter((g) => g.isVip);
        break;
      case 'in_house':
        result = result.filter((g) => g.activeBooking?.status === 'checked_in');
        break;
      case 'loyalty':
        result = result.filter((g) => g.loyaltyTier && g.loyaltyTier !== 'none');
        break;
    }

    // Search
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      result = result.filter(
        (g) =>
          g.firstName.toLowerCase().includes(q) ||
          g.lastName.toLowerCase().includes(q) ||
          (g.email && g.email.toLowerCase().includes(q)) ||
          (g.phone && g.phone.includes(q)) ||
          (g.activeBooking?.confirmationCode && g.activeBooking.confirmationCode.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allGuests, activeFilter, debouncedSearchQuery]);

  // ─── Stats computed from all guests ─────────────────────────────
  const stats = useMemo(() => {
    const total = allGuests.length;
    const vip = allGuests.filter((g) => g.isVip).length;
    const inHouse = allGuests.filter((g) => g.activeBooking?.status === 'checked_in').length;
    const totalNights = allGuests.reduce((sum, g) => sum + g.totalStays, 0);
    const avgStay = total > 0 ? (totalNights / total).toFixed(1) : '0';
    return { total, vip, inHouse, avgStay };
  }, [allGuests]);

  // Filter pill counts
  const filterCounts = useMemo(() => ({
    all: allGuests.length,
    vip: allGuests.filter((g) => g.isVip).length,
    in_house: allGuests.filter((g) => g.activeBooking?.status === 'checked_in').length,
    loyalty: allGuests.filter((g) => g.loyaltyTier && g.loyaltyTier !== 'none').length,
  }), [allGuests]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilter('all');
  }, []);

  const isFiltered = searchQuery.trim() !== '' || activeFilter !== 'all';

  // ─── CRUD Handlers ──────────────────────────────────────────────
  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/guests');
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      if (result.success) setAllGuests(result.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch guests', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.firstName || !formData.lastName) {
      toast({ title: 'Validation Error', description: 'First name and last name are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Guest created successfully' });
        setIsCreateOpen(false);
        resetForm();
        fetchGuests();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create guest', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create guest', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedGuest) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Guest updated successfully' });
        setIsEditOpen(false);
        setSelectedGuest(null);
        fetchGuests();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update guest', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update guest', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGuest) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Guest deleted successfully' });
        setIsDeleteOpen(false);
        setSelectedGuest(null);
        fetchGuests();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete guest', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete guest', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email || '',
      phone: guest.phone || '',
      nationality: guest.nationality || '',
      // M-38: Fixed hard-coded empty strings — populate from guest data
      address: guest.address || '',
      city: guest.city || '',
      state: guest.state || '',
      country: guest.country || '',
      postalCode: guest.postalCode || '',
      idType: guest.idType || '',
      idNumber: guest.idNumber || '',
      notes: guest.notes || '',
      loyaltyTier: guest.loyaltyTier,
      isVip: guest.isVip,
      vipLevel: guest.vipLevel || '',
      source: guest.source,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', nationality: '',
      address: '', city: '', state: '', country: '', postalCode: '',
      idType: '', idNumber: '', notes: '', loyaltyTier: 'bronze',
      isVip: false, vipLevel: '', source: 'direct',
    });
  };

  // ─── Helpers ────────────────────────────────────────────────────
  const getInitials = (firstName: string, lastName: string) =>
    `${firstName[0]}${lastName[0]}`.toUpperCase();

  const getAvatarGradient = (guest: Guest) => {
    if (guest.isVip) return 'from-amber-400 to-amber-600';
    const option = loyaltyTiers.find((o) => o.value === guest.loyaltyTier);
    return option?.avatarBg || 'from-emerald-500 to-teal-600';
  };

  const getLoyaltyBadge = (tier: string) => {
    const option = loyaltyTiers.find((o) => o.value === tier);
    if (!option) return null;
    return (
      <Badge variant="secondary" className={cn('text-xs font-medium shadow-sm border-0', option.color)}>
        {option.label}
      </Badge>
    );
  };

  const getSourceLabel = (source: string) =>
    sources.find((s) => s.value === source)?.label || source;

  const getGuestStatusLabel = (guest: Guest): { text: string; dotClass: string } => {
    if (guest.activeBooking?.status === 'checked_in') {
      return { text: 'In House', dotClass: 'bg-emerald-500' };
    }
    if (guest.activeBooking?.status === 'confirmed') {
      return { text: 'Expected', dotClass: 'bg-amber-500' };
    }
    return { text: 'Checked Out', dotClass: 'bg-gray-400' };
  };

  // ─── Loading Skeletons ──────────────────────────────────────────
  const MobileSkeletonCards = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" /></div>
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-10 flex-1 rounded-md" />
              <Skeleton className="h-10 flex-1 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const DesktopSkeletonTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Loyalty</TableHead>
          <TableHead>Stays</TableHead>
          <TableHead>Total Spent</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 6 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
              </div>
            </TableCell>
            <TableCell><div className="space-y-1"><Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-24" /></div></TableCell>
            <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><div className="flex justify-end gap-1"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-8 w-8 rounded-md" /></div></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // ─── Mobile Guest Card ──────────────────────────────────────────
  const GuestCard = ({ guest, index }: { guest: Guest; index: number }) => {
    const status = getGuestStatusLabel(guest);
    return (
      <motion.div
        custom={index}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <Card className="hover:bg-muted/30 transition-colors duration-200 group">
          <CardContent className="p-4 space-y-3">
            {/* Row 1: Avatar + Name + Badges */}
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all duration-200 group-hover:ring-primary/30">
                <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
                  {getInitials(guest.firstName, guest.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-base truncate">
                    {guest.firstName} {guest.lastName}
                  </p>
                  {guest.isVip && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[10px] font-bold shadow-sm">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {guest.loyaltyTier && guest.loyaltyTier !== 'none' && getLoyaltyBadge(guest.loyaltyTier)}
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', status.dotClass)} />
                    {status.text}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Email & Phone */}
            {(guest.email || guest.phone) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {guest.email && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{guest.email}</span>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Phone className="h-3 w-3" />
                    <span>{guest.phone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Room & Booking */}
            {guest.activeBooking && (
              <div className="flex flex-wrap gap-3 text-xs">
                {guest.activeBooking.roomNumber && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">Room {guest.activeBooking.roomNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60">
                  <Hotel className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{guest.activeBooking.confirmationCode}</span>
                </div>
              </div>
            )}

            {/* Row 4: Quick actions */}
            <div className="flex gap-2 pt-1">
              {onSelectGuest && (
                <Button variant="outline" size="sm" className="flex-1 h-10 text-xs" onClick={() => onSelectGuest(guest.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  View Profile
                </Button>
              )}
              <Button variant="outline" size="sm" className="flex-1 h-10 text-xs" onClick={() => openEditDialog(guest)}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ─── Tablet Guest Card (compact) ────────────────────────────────
  const GuestCardCompact = ({ guest, index }: { guest: Guest; index: number }) => {
    const status = getGuestStatusLabel(guest);
    return (
      <motion.div
        custom={index}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <Card className="hover:bg-muted/30 transition-colors duration-200 group">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all duration-200 group-hover:ring-primary/30">
                <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
                  {getInitials(guest.firstName, guest.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{guest.firstName} {guest.lastName}</p>
                  {guest.isVip && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[10px] font-bold shadow-sm">
                      <Star className="h-2.5 w-2.5 fill-current" /> VIP
                    </span>
                  )}
                  {guest.loyaltyTier && guest.loyaltyTier !== 'none' && getLoyaltyBadge(guest.loyaltyTier)}
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {guest.email && (
                    <span className="flex items-center gap-1 min-w-0 truncate"><Mail className="h-3 w-3 shrink-0" />{guest.email}</span>
                  )}
                  {guest.phone && (
                    <span className="flex items-center gap-1 shrink-0"><Phone className="h-3 w-3" />{guest.phone}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {onSelectGuest && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onSelectGuest(guest.id)} aria-label="View Profile"><Eye className="h-4 w-4" /></Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditDialog(guest)} aria-label="Edit guest"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openDeleteDialog(guest)} aria-label="Delete guest"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', status.dotClass)} />{status.text}</span>
              {guest.activeBooking?.roomNumber && <span className="text-muted-foreground">Room {guest.activeBooking.roomNumber}</span>}
              {guest.activeBooking?.confirmationCode && <span className="font-mono text-muted-foreground">{guest.activeBooking.confirmationCode}</span>}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{guest.totalStays}</span>
                <span className="text-muted-foreground">stays</span>
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{formatCurrency(guest.totalSpent)}</span>
              </span>
              <Badge variant="outline" className="text-xs">{getSourceLabel(guest.source)}</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ─── Desktop Table Row ──────────────────────────────────────────
  const DesktopTableRow = ({ guest, index }: { guest: Guest; index: number }) => {
    const status = getGuestStatusLabel(guest);
    return (
      <motion.tr
        custom={index}
        variants={rowVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="group hover:bg-muted/40 transition-colors duration-150 border-b border-border"
      >
        <td className="w-[220px] py-3 px-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-offset-1 ring-offset-background ring-transparent transition-all duration-200 group-hover:ring-primary/30">
              <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
                {getInitials(guest.firstName, guest.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="font-semibold text-sm truncate max-w-[130px]">{guest.firstName} {guest.lastName}</p>
                  </TooltipTrigger>
                  <TooltipContent>{guest.firstName} {guest.lastName}</TooltipContent>
                </Tooltip>
                {guest.isVip && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-[10px] font-bold shadow-sm">
                    <Star className="h-2.5 w-2.5 fill-current" /> VIP
                  </span>
                )}
                {guest.loyaltyTier && guest.loyaltyTier !== 'none' && getLoyaltyBadge(guest.loyaltyTier)}
              </div>
              {guest.nationality && <p className="text-xs text-muted-foreground">{guest.nationality}</p>}
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="space-y-1">
            {guest.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-sm"><Mail className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate max-w-[150px]">{guest.email}</span></div>
                </TooltipTrigger>
                <TooltipContent>{guest.email}</TooltipContent>
              </Tooltip>
            )}
            {guest.phone && <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3 w-3 shrink-0" /><span>{guest.phone}</span></div>}
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className={cn('h-2 w-2 rounded-full shrink-0', status.dotClass)} />
            {status.text}
          </span>
          {guest.activeBooking?.roomNumber && (
            <span className="ml-2 text-xs text-muted-foreground">Rm {guest.activeBooking.roomNumber}</span>
          )}
          {guest.activeBooking?.confirmationCode && (
            <span className="ml-2 text-xs font-mono text-muted-foreground">{guest.activeBooking.confirmationCode}</span>
          )}
        </td>
        <td className="py-3 px-4">
          {guest.loyaltyTier && guest.loyaltyTier !== 'none' ? getLoyaltyBadge(guest.loyaltyTier) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="py-3 px-4">
          <div className="text-sm"><span className="font-medium">{guest.totalStays}</span> <span className="text-muted-foreground">stays</span></div>
        </td>
        <td className="py-3 px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-medium text-sm">{formatCurrency(guest.totalSpent)}</span>
            </TooltipTrigger>
            <TooltipContent>{formatCurrency(guest.totalSpent)}</TooltipContent>
          </Tooltip>
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex justify-end gap-1">
            {onSelectGuest && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onSelectGuest(guest.id)} aria-label="View Profile"><Eye className="h-4 w-4" /></Button>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditDialog(guest)} aria-label="Edit guest"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openDeleteDialog(guest)} aria-label="Delete guest"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </td>
      </motion.tr>
    );
  };

  // ─── Empty State ────────────────────────────────────────────────
  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-muted-foreground"
    >
      <div className="h-20 w-20 rounded-full bg-muted/60 flex items-center justify-center mb-5">
        <Users className="h-10 w-10 opacity-50" />
      </div>
      <p className="font-semibold text-lg text-foreground">No guests found</p>
      <p className="text-sm mt-1.5 text-center max-w-xs">Try adjusting your search or filters</p>
      {isFiltered && (
        <Button variant="outline" className="mt-5" onClick={clearFilters}>
          <Filter className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </motion.div>
  );

  // ─── Filter Pills ───────────────────────────────────────────────
  const filterPills: { key: QuickFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'vip', label: 'VIP Only' },
    { key: 'in_house', label: 'In House' },
    { key: 'loyalty', label: 'Loyalty' },
  ];

  // ─── Guest Form (responsive) ────────────────────────────────────
  const formContent = <GuestForm formData={formData} setFormData={setFormData} />;

  const createFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <><DialogTitle>Add New Guest</DialogTitle><DialogDescription>Create a new guest profile</DialogDescription></>
        ) : (
          <><DrawerTitle>Add New Guest</DrawerTitle><DrawerDescription>Create a new guest profile</DrawerDescription></>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 -mx-1"><div className="py-2">{formContent}</div></div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Guest</Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button onClick={handleCreate} disabled={isSaving} className="w-full">{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Guest</Button>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="w-full">Cancel</Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  const editFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <><DialogTitle>Edit Guest</DialogTitle><DialogDescription>Update guest information</DialogDescription></>
        ) : (
          <><DrawerTitle>Edit Guest</DrawerTitle><DrawerDescription>Update guest information</DrawerDescription></>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 -mx-1"><div className="py-2">{formContent}</div></div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update Guest</Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button onClick={handleUpdate} disabled={isSaving} className="w-full">{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update Guest</Button>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="w-full">Cancel</Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  const deleteFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <><DialogTitle>Delete Guest</DialogTitle><DialogDescription>Are you sure you want to delete &quot;{selectedGuest?.firstName} {selectedGuest?.lastName}&quot;? This action cannot be undone.</DialogDescription></>
        ) : (
          <><DrawerTitle>Delete Guest</DrawerTitle><DrawerDescription>Are you sure you want to delete &quot;{selectedGuest?.firstName} {selectedGuest?.lastName}&quot;? This action cannot be undone.</DrawerDescription></>
        )}
      </div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete</Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving} className="w-full">{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete</Button>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="w-full">Cancel</Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" />
            Guests
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest profiles and information
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Guest
        </Button>
      </div>

      {/* ─── Stats Summary Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Total Guests</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.vip}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">VIP Guests</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-emerald-500 dark:text-emerald-400">{stats.inHouse}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">In House</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{stats.avgStay}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">Avg Stay (nights)</div>
        </Card>
      </div>

      {/* ─── Search + Filter Pills ──────────────────────────────────── */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, phone, or booking code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-11 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setActiveFilter(pill.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border',
                activeFilter === pill.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {pill.label}
              <span className={cn(
                'ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full',
                activeFilter === pill.key
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {filterCounts[pill.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Guest List ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {isLoading ? (
            <div className="py-2">
              {isLargeDesktop ? <DesktopSkeletonTable /> : <MobileSkeletonCards />}
            </div>
          ) : filteredGuests.length === 0 ? (
            <EmptyState />
          ) : isLargeDesktop ? (
            /* ── Desktop: Full Table ─────────────────────────────────── */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status / Room</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Loyalty</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stays</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spent</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <AnimatePresence mode="popLayout">
                  <tbody>
                    {filteredGuests.map((guest, i) => (
                      <DesktopTableRow key={guest.id} guest={guest} index={i} />
                    ))}
                  </tbody>
                </AnimatePresence>
              </table>
            </div>
          ) : (
            /* ── Mobile / Tablet: Cards ──────────────────────────────── */
            <ScrollArea className={isDesktop ? 'h-[600px]' : 'h-[calc(100vh-420px)] min-h-[400px]'}>
              <div className="space-y-3 pr-2">
                <AnimatePresence mode="popLayout">
                  {filteredGuests.map((guest, i) =>
                    isDesktop ? (
                      <GuestCardCompact key={guest.id} guest={guest} index={i} />
                    ) : (
                      <GuestCard key={guest.id} guest={guest} index={i} />
                    )
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Dialog / Drawer ─────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">{createFormBody}</DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DrawerContent className="max-h-[90vh] flex flex-col">{createFormBody}</DrawerContent>
        </Drawer>
      )}

      {/* ─── Edit Dialog / Drawer ───────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">{editFormBody}</DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent className="max-h-[90vh] flex flex-col">{editFormBody}</DrawerContent>
        </Drawer>
      )}

      {/* ─── Delete Dialog / Drawer ─────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>{deleteFormBody}</DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DrawerContent>{deleteFormBody}</DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

// ─── Guest Form Component (responsive) ────────────────────────────────

interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  notes: string;
  loyaltyTier: string;
  isVip: boolean;
  vipLevel: string;
  source: string;
}

interface GuestFormProps {
  formData: GuestFormData;
  setFormData: React.Dispatch<React.SetStateAction<GuestFormData>>;
}

function GuestForm({ formData, setFormData }: GuestFormProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" value={formData.firstName as string} onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="John" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" value={formData.lastName as string} onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Smith" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={formData.email as string} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} placeholder="john.smith@email.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={formData.phone as string} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+1 555 123 4567" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input id="nationality" value={formData.nationality as string} onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="United States" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value={formData.country as string} onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))} placeholder="United States" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={formData.city as string} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} placeholder="New York" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select value={formData.source as string} onValueChange={(value) => setFormData((prev) => ({ ...prev, source: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loyaltyTier">Loyalty Tier</Label>
          <Select value={formData.loyaltyTier as string} onValueChange={(value) => setFormData((prev) => ({ ...prev, loyaltyTier: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {loyaltyTiers.map((tier) => (
                <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="isVip">VIP Status</Label>
          <Select value={(formData.isVip as boolean) ? 'true' : 'false'} onValueChange={(value) => setFormData((prev) => ({ ...prev, isVip: value === 'true' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Regular Guest</SelectItem>
              <SelectItem value="true">VIP Guest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={formData.notes as string} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Special preferences, notes about the guest..." rows={3} />
      </div>
    </div>
  );
}
