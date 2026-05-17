'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Globe,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ExternalLink,
  Wifi,
  ShoppingCart,
  ChevronRight,
  Layers,
  MapPin,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface ChannelInfo {
  id: string;
  name: string;
  category: string;
  region: string;
  country?: string;
  commissionRate?: number;
  connectionType: 'api' | 'channel_manager' | 'xml' | 'pending';
  status: 'active' | 'coming_soon' | 'beta';
  description?: string;
  website?: string;
}

interface ChannelApiResponse {
  channels: ChannelInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: string[];
  regions: string[];
}

// ============================================
// CONSTANTS & HELPERS
// ============================================

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Channels',
  ota_global: 'Global OTAs',
  ota_regional: 'Regional OTAs',
  ota_niche: 'Niche OTAs',
  vacation_rental: 'Vacation Rentals',
  hostel: 'Hostels & Budget',
  metasearch: 'Metasearch',
  gds: 'GDS',
  wholesaler: 'Wholesalers',
  bedbank: 'Bedbanks',
  tour_operator: 'Tour Operators',
  corporate: 'Corporate / Direct',
};

const CATEGORY_COLORS: Record<string, string> = {
  ota_global: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  ota_regional: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  ota_niche: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20',
  vacation_rental: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20',
  hostel: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  metasearch: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  gds: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20',
  wholesaler: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20',
  bedbank: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/20',
  tour_operator: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  corporate: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',
};

const CATEGORY_ICONS: Record<string, typeof Globe> = {
  ota_global: Globe,
  ota_regional: MapPin,
  ota_niche: Star,
  vacation_rental: Layers,
  hostel: ShoppingCart,
  metasearch: Search,
  gds: Wifi,
  wholesaler: Layers,
  bedbank: Layers,
  tour_operator: Globe,
  corporate: Layers,
};

const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  north_america: 'North America',
  europe: 'Europe',
  asia_pacific: 'Asia Pacific',
  middle_east: 'Middle East',
  africa: 'Africa',
  latin_america: 'Latin America',
  south_asia: 'South Asia',
  southeast_asia: 'Southeast Asia',
  east_asia: 'East Asia',
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  connected: {
    label: 'Connected',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle,
  },
  available: {
    label: 'Available',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon: XCircle,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    icon: Wifi,
  },
};

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

function getStatusConfig(channel: ChannelInfo) {
  // Simulate connected state — in production this would come from connection status
  const isTopChannel = ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'vrbo'].includes(channel.id);
  if (isTopChannel) return STATUS_CONFIG.connected;
  if (channel.status === 'coming_soon') return STATUS_CONFIG.pending;
  return STATUS_CONFIG.available;
}

// ============================================
// LOADING SKELETON
// ============================================

function ChannelCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <ChannelCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// CHANNEL CARD
// ============================================

function ChannelCard({
  channel,
  onConnect,
}: {
  channel: ChannelInfo;
  onConnect: (channel: ChannelInfo) => void;
}) {
  const status = getStatusConfig(channel);
  const StatusIcon = status.icon;
  const isComingSoon = channel.status === 'coming_soon';
  const isBeta = channel.status === 'beta';
  const isPending = status.label === 'Pending';

  return (
    <Card
      className={cn(
        'group relative border-border/50 transition-all duration-200',
        'hover:border-border hover:shadow-md hover:-translate-y-0.5',
        'bg-card'
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0',
                'bg-gradient-to-br from-primary/80 to-primary'
              )}
            >
              {channel.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate leading-tight">{channel.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {CATEGORY_LABELS[channel.category] || channel.category}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 font-medium', status.className)}
            >
              <StatusIcon className="h-3 w-3 mr-0.5" />
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Category + Region badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', getCategoryColor(channel.category))}
          >
            {CATEGORY_LABELS[channel.category] || channel.category}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <MapPin className="h-2.5 w-2.5 mr-0.5" />
            {REGION_LABELS[channel.region] || channel.region}
          </Badge>
          {isBeta && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
              Beta
            </Badge>
          )}
          {isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Coming Soon
            </Badge>
          )}
        </div>

        {/* Commission + Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {channel.commissionRate !== undefined ? (
              <span className="font-medium text-foreground">
                {channel.commissionRate === 0 ? 'CPA Model' : `${channel.commissionRate}%`}
              </span>
            ) : (
              <span className="italic">Commission varies</span>
            )}
            <span className="ml-1">commission</span>
          </div>
          <div className="flex gap-1.5">
            {channel.website && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href={channel.website} target="_blank" rel="noopener noreferrer" title="Visit website">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button
              size="sm"
              className={cn(
                'h-7 text-xs px-2.5',
                status.label === 'Connected'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : isComingSoon || isPending
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
              disabled={isComingSoon || isPending}
              onClick={() => onConnect(channel)}
            >
              {status.label === 'Connected' ? 'Manage' : isComingSoon ? 'Notify Me' : 'Connect'}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// CONNECT DIALOG
// ============================================

function ConnectDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: ChannelInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    hotelId: '',
    endpointUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = channel ? getStatusConfig(channel) : null;
  const isAlreadyConnected = status?.label === 'Connected';

  // Reset form when channel changes
  useEffect(() => {
    if (channel) {
      setFormData({ apiKey: '', apiSecret: '', hotelId: '', endpointUrl: '' });
    }
  }, [channel]);

  const handleSubmit = async () => {
    if (!channel) return;

    if (!formData.apiKey.trim()) {
      toast.error('Please enter your API Key');
      return;
    }
    if (!formData.hotelId.trim()) {
      toast.error('Please enter your Hotel / Property ID');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(`Successfully connected to ${channel.name}!`);
      onOpenChange(false);
    } catch {
      toast.error(`Failed to connect to ${channel.name}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 pb-2">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                'bg-gradient-to-br from-primary/80 to-primary'
              )}
            >
              {channel.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-lg">{channel.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn('text-[10px]', getCategoryColor(channel.category))}>
                  {CATEGORY_LABELS[channel.category]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <MapPin className="h-2.5 w-2.5 mr-0.5" />
                  {REGION_LABELS[channel.region]}
                </Badge>
                {channel.commissionRate !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {channel.commissionRate === 0 ? 'CPA' : `${channel.commissionRate}%`} commission
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-1">
          <div className="space-y-4 pb-2">
            {/* Connection status banner */}
            {isAlreadyConnected && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  This channel is already connected. You can update credentials or manage settings below.
                </p>
              </div>
            )}

            {/* Channel features */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Instant Booking', active: true },
                { label: 'Content Sync', active: true },
                { label: 'Messaging', active: ['booking_com', 'expedia', 'airbnb', 'vrbo'].includes(channel.id) },
                { label: 'Review Mgmt', active: ['booking_com', 'airbnb', 'vrbo', 'tripadvisor'].includes(channel.id) },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className={cn(
                    'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border',
                    feature.active
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'border-border bg-muted/50 text-muted-foreground'
                  )}
                >
                  {feature.active ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {feature.label}
                </div>
              ))}
            </div>

            {/* API Credentials Form */}
            <div className="space-y-3 pt-1">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Wifi className="h-4 w-4 text-muted-foreground" />
                API Credentials
              </h4>

              <div className="space-y-2">
                <Label htmlFor="ch-api-key" className="text-xs">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ch-api-key"
                  placeholder="Enter your API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ch-api-secret" className="text-xs">
                  API Secret
                </Label>
                <Input
                  id="ch-api-secret"
                  type="password"
                  placeholder="Enter your API secret (optional)"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData((prev) => ({ ...prev, apiSecret: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ch-hotel-id" className="text-xs">
                  Hotel / Property ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ch-hotel-id"
                  placeholder="e.g., 123456"
                  value={formData.hotelId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, hotelId: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ch-endpoint" className="text-xs">
                  Custom Endpoint URL
                </Label>
                <Input
                  id="ch-endpoint"
                  placeholder="https://api.example.com (optional)"
                  value={formData.endpointUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Help link */}
            {channel.website && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Need API credentials? Visit the{' '}
                  <a
                    href={channel.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                  >
                    {channel.name} Partner Portal
                  </a>
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              isAlreadyConnected
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : ''
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
                Connecting...
              </span>
            ) : isAlreadyConnected ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Update Connection
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" />
                Connect Channel
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// STATS HEADER
// ============================================

function StatsHeader({
  total,
  connected,
  categories,
}: {
  total: number;
  connected: number;
  categories: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-border/50 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Channels</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-gradient-to-br from-card to-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-400">{connected}</p>
            <p className="text-xs text-muted-foreground mt-1">Connected</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-gradient-to-br from-card to-sky-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
            <Globe className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-sky-600 dark:text-sky-400">{categories}</p>
            <p className="text-xs text-muted-foreground mt-1">Categories</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ChannelDirectory() {
  // State
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [totalChannels, setTotalChannels] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('category', activeTab);
      if (filterRegion !== 'all') params.set('region', filterRegion);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '200');

      const res = await fetch(`/api/channel-manager/channels?${params.toString()}`);
      const data: ChannelApiResponse = await res.json();

      if (data.channels) {
        setChannels(data.channels);
        setTotalChannels(data.total || data.channels.length);
      }
      if (data.categories) setCategories(data.categories);
      if (data.regions) setRegions(data.regions);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to load channel directory');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterRegion, searchQuery]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Connected count (simulated based on top channels)
  const connectedCount = useMemo(() => {
    return channels.filter((ch) => ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'vrbo'].includes(ch.id)).length;
  }, [channels]);

  // Stats — fetch all channels for total count
  const [allChannelTotal, setAllChannelTotal] = useState(0);
  useEffect(() => {
    async function fetchAllStats() {
      try {
        const res = await fetch('/api/channel-manager/channels?limit=1');
        const data: ChannelApiResponse = await res.json();
        if (data.total) setAllChannelTotal(data.total);
        if (data.categories) setCategories(data.categories);
        if (data.regions) setRegions(data.regions);
      } catch {
        // silent
      }
    }
    fetchAllStats();
  }, []);

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allChannelTotal || 0 };
    channels.forEach((ch) => {
      counts[ch.category] = (counts[ch.category] || 0) + 1;
    });
    return counts;
  }, [channels, allChannelTotal]);

  // Handle connect
  const handleConnect = (channel: ChannelInfo) => {
    if (channel.status === 'coming_soon') {
      toast.info(`${channel.name} is coming soon! We'll notify you when it's available.`);
      return;
    }
    setSelectedChannel(channel);
    setConnectDialogOpen(true);
  };

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(debouncedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Channel Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and connect to 200+ OTA, metasearch, GDS, and distribution channels worldwide.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">
          <Layers className="h-3 w-3 mr-1" />
          {allChannelTotal} channels available
        </Badge>
      </div>

      {/* Stats */}
      <StatsHeader
        total={allChannelTotal || totalChannels}
        connected={connectedCount}
        categories={categories.length}
      />

      {/* Search & Filter */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels by name..."
                value={debouncedSearch}
                onChange={(e) => setDebouncedSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Region filter */}
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {REGION_LABELS[region] || region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ScrollArea className="max-w-full">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 gap-0.5 flex-wrap">
            <TabsTrigger
              value="all"
              className="text-xs px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              All
              <span className="ml-1.5 text-[10px] opacity-60">{categoryCounts.all || ''}</span>
            </TabsTrigger>
            {Object.entries(CATEGORY_LABELS)
              .filter(([key]) => key !== 'all' && categories.includes(key))
              .map(([key, label]) => {
                const Icon = CATEGORY_ICONS[key] || Globe;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="text-xs px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-3 w-3 mr-1 hidden sm:inline-block" />
                    {label}
                    <span className="ml-1.5 text-[10px] opacity-60">{categoryCounts[key] || ''}</span>
                  </TabsTrigger>
                );
              })}
          </TabsList>
        </ScrollArea>

        {/* Channel Grid */}
        {loading ? (
          <ChannelGridSkeleton />
        ) : channels.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-muted-foreground">No channels found</h3>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try adjusting your search or filter criteria.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => {
                  setDebouncedSearch('');
                  setFilterRegion('all');
                  setActiveTab('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Showing {channels.length} of {totalChannels} channels
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {channels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} onConnect={handleConnect} />
              ))}
            </div>
          </div>
        )}
      </Tabs>

      {/* Connect Dialog */}
      <ConnectDialog
        channel={selectedChannel}
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
      />
    </div>
  );
}
