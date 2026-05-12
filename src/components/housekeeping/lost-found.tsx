'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Plus,
  Loader2,
  PackageSearch,
  Camera,
  MapPin,
  Calendar,
  User,
  Tag,
  Image as ImageIcon,
  Eye,
  Link2,
  ArrowRightLeft,
  Trash2,
  RefreshCw,
  Filter,
  X,
  Package,
  Phone,
  Mail,
  MessageSquare,
  Archive,
  PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  category: string;
  description: string;
  location: string;
  finderName?: string;
  finderContact?: string;
  reporterName?: string;
  reporterContact?: string;
  photos: string[];
  status: 'reported' | 'matched' | 'returned' | 'disposed' | 'claimed';
  propertyId: string;
  matchedGuestId?: string;
  matchedItemId?: string;
  notes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics', color: 'bg-blue-500' },
  { value: 'clothing', label: 'Clothing', color: 'bg-pink-500' },
  { value: 'documents', label: 'Documents', color: 'bg-amber-500' },
  { value: 'accessories', label: 'Accessories', color: 'bg-violet-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

const STATUS_OPTIONS = [
  { value: 'reported', label: 'Reported', color: 'bg-gray-500' },
  { value: 'matched', label: 'Matched', color: 'bg-blue-500' },
  { value: 'returned', label: 'Returned', color: 'bg-emerald-500' },
  { value: 'disposed', label: 'Disposed', color: 'bg-red-500' },
  { value: 'claimed', label: 'Claimed', color: 'bg-purple-500' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  reported: { label: 'Reported', color: 'bg-gray-500' },
  matched: { label: 'Matched', color: 'bg-blue-500' },
  returned: { label: 'Returned', color: 'bg-emerald-500' },
  disposed: { label: 'Disposed', color: 'bg-red-500' },
  claimed: { label: 'Claimed', color: 'bg-purple-500' },
};

export default function LostFound() {
  const { toast } = useToast();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialog states
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Report form
  const [reportForm, setReportForm] = useState({
    type: 'found' as 'lost' | 'found',
    category: 'electronics',
    description: '',
    location: '',
    finderName: '',
    finderContact: '',
    notes: '',
  });

  // Fetch items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/lost-found?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setItems(result.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load items', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, categoryFilter, dateFrom, dateTo, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  // Report item
  const handleReport = async () => {
    if (!reportForm.description || !reportForm.location) {
      toast({ title: 'Validation Error', description: 'Description and location are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Item reported successfully' });
        setIsReportOpen(false);
        setReportForm({ type: 'found', category: 'electronics', description: '', location: '', finderName: '', finderContact: '', notes: '' });
        fetchItems();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to report item', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to report item', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Match to guest
  const handleMatchGuest = async (itemId: string) => {
    try {
      const res = await fetch(`/api/lost-found/${itemId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match_guest' }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Item matched to guest' });
        fetchItems();
        if (selectedItem?.id === itemId) {
          setSelectedItem(result.data);
        }
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to match', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to match item', variant: 'destructive' });
    }
  };

  // Return item
  const handleReturn = async (itemId: string) => {
    try {
      const res = await fetch(`/api/lost-found/${itemId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Item marked as returned' });
        setIsDetailOpen(false);
        fetchItems();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to return', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to return item', variant: 'destructive' });
    }
  };

  // Dispose item
  const handleDispose = async (itemId: string) => {
    try {
      const res = await fetch(`/api/lost-found/${itemId}/dispose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Item marked as disposed' });
        setIsDetailOpen(false);
        fetchItems();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to dispose', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to dispose item', variant: 'destructive' });
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return (
      <Badge variant="secondary" className={cn('text-white', cat?.color || 'bg-gray-500')}>
        {cat?.label || category}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_MAP[status];
    return (
      <Badge variant="secondary" className={cn('text-white', s?.color || 'bg-gray-500')}>
        {s?.label || status}
      </Badge>
    );
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'lost') return item.type === 'lost';
    if (activeTab === 'found') return item.type === 'found';
    if (activeTab === 'matched') return item.status === 'matched';
    if (activeTab === 'returned') return item.status === 'returned';
    return true;
  });

  const stats = {
    total: items.length,
    lost: items.filter(i => i.type === 'lost').length,
    found: items.filter(i => i.type === 'found').length,
    matched: items.filter(i => i.status === 'matched').length,
    returned: items.filter(i => i.status === 'returned').length,
  };

  const openItemDetail = (item: LostFoundItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            Lost & Found
          </h2>
          <p className="text-sm text-muted-foreground">
            Track and manage lost and found items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsReportOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Report Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3 sm:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, color: 'from-gray-600 to-gray-400', bg: 'bg-gray-500/10', icon: Package },
          { label: 'Lost', value: stats.lost, color: 'from-orange-600 to-orange-400', bg: 'bg-orange-500/10', icon: Search },
          { label: 'Found', value: stats.found, color: 'from-emerald-600 to-teal-400', bg: 'bg-emerald-500/10', icon: PackageCheck },
          { label: 'Matched', value: stats.matched, color: 'from-blue-600 to-blue-400', bg: 'bg-blue-500/10', icon: Link2 },
          { label: 'Returned', value: stats.returned, color: 'from-green-600 to-green-400', bg: 'bg-green-500/10', icon: ArrowRightLeft },
        ].map(stat => (
          <Card key={stat.label} className="p-3 sm:p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 sm:p-2 rounded-lg', stat.bg)}>
                <stat.icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 bg-gradient-to-r bg-clip-text text-transparent', stat.color)} style={{ color: 'inherit' }} />
              </div>
              <div>
                <div className={cn('text-xl sm:text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent', stat.color)}>
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-40"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-40"
              placeholder="To date"
            />
            {(searchQuery || categoryFilter !== 'all' || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Items Grid */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
          <TabsTrigger value="found">Found</TabsTrigger>
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-32 w-full mb-4 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PackageSearch className="h-12 w-12 mb-4" />
              <p>No items found</p>
              <p className="text-sm mt-1">Report a new lost or found item</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group"
                  onClick={() => openItemDetail(item)}
                >
                  {/* Photo placeholder */}
                  <div className="relative h-40 bg-muted/50 flex items-center justify-center border-b">
                    {item.photos?.length > 0 ? (
                      <img
                        src={item.photos[0]}
                        alt={item.description}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs">No photo</span>
                      </div>
                    )}
                    {/* Type overlay */}
                    <Badge
                      className={cn(
                        'absolute top-2 left-2 text-white',
                        item.type === 'lost' ? 'bg-orange-500' : 'bg-emerald-500',
                      )}
                    >
                      {item.type === 'lost' ? 'Lost' : 'Found'}
                    </Badge>
                    {/* Status overlay */}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-sm line-clamp-2">{item.description}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        {getCategoryBadge(item.category)}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.createdAt), 'MMM d')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{item.location}</span>
                      </div>

                      {(item.finderName || item.reporterName) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{item.finderName || item.reporterName}</span>
                        </div>
                      )}

                      <Separator className="my-2" />

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>

      {/* Report Item Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Item</DialogTitle>
            <DialogDescription>
              Report a lost or found item in the hotel
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Type *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={reportForm.type === 'lost' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setReportForm(prev => ({ ...prev, type: 'lost' }))}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Lost Item
                </Button>
                <Button
                  type="button"
                  variant={reportForm.type === 'found' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setReportForm(prev => ({ ...prev, type: 'found' }))}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Found Item
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={reportForm.category}
                onValueChange={(value) => setReportForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                placeholder="Describe the item (color, brand, distinguishing features)..."
                value={reportForm.description}
                onChange={(e) => setReportForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                placeholder="Where was it lost/found?"
                value={reportForm.location}
                onChange={(e) => setReportForm(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finderName">
                  {reportForm.type === 'found' ? 'Finder Name' : 'Reporter Name'}
                </Label>
                <Input
                  placeholder="Name"
                  value={reportForm.finderName}
                  onChange={(e) => setReportForm(prev => ({ ...prev, finderName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finderContact">
                  {reportForm.type === 'found' ? 'Finder Contact' : 'Reporter Contact'}
                </Label>
                <Input
                  placeholder="Phone or email"
                  value={reportForm.finderContact}
                  onChange={(e) => setReportForm(prev => ({ ...prev, finderContact: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                placeholder="Any additional information..."
                value={reportForm.notes}
                onChange={(e) => setReportForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Photos Upload Area */}
            <div className="space-y-2">
              <Label>Photos</Label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                <Camera className="h-8 w-8" />
                <p className="text-sm">Click to upload photos</p>
                <p className="text-xs">PNG, JPG up to 10MB each</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>Cancel</Button>
            <Button onClick={handleReport} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <PackageSearch className="h-5 w-5" />
                  Item Details
                </SheetTitle>
                <SheetDescription>
                  {selectedItem.type === 'lost' ? 'Lost' : 'Found'} item — {getCategoryBadge(selectedItem.category)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Photo */}
                <div className="h-48 bg-muted/50 rounded-lg flex items-center justify-center border overflow-hidden">
                  {selectedItem.photos?.length > 0 ? (
                    <img src={selectedItem.photos[0]} alt={selectedItem.description} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-sm">No photo available</span>
                    </div>
                  )}
                </div>

                {/* Status & Type */}
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-white', selectedItem.type === 'lost' ? 'bg-orange-500' : 'bg-emerald-500')}>
                    {selectedItem.type === 'lost' ? 'Lost' : 'Found'}
                  </Badge>
                  {getStatusBadge(selectedItem.status)}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{selectedItem.description}</p>
                  </div>

                  <Separator />

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground w-20">Location:</span>
                      <span>{selectedItem.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground w-20">Reported:</span>
                      <span>{format(new Date(selectedItem.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {(selectedItem.finderName || selectedItem.reporterName) && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground w-20">
                          {selectedItem.type === 'found' ? 'Finder:' : 'Reporter:'}
                        </span>
                        <span>{selectedItem.finderName || selectedItem.reporterName}</span>
                      </div>
                    )}
                    {(selectedItem.finderContact || selectedItem.reporterContact) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground w-20">Contact:</span>
                        <span>{selectedItem.finderContact || selectedItem.reporterContact}</span>
                      </div>
                    )}
                  </div>

                  {selectedItem.notes && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="text-sm text-muted-foreground">{selectedItem.notes}</p>
                      </div>
                    </>
                  )}

                  {selectedItem.resolvedAt && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-2 text-sm">
                        <PackageCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-muted-foreground w-20">Resolved:</span>
                        <span>{format(new Date(selectedItem.resolvedAt), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  {selectedItem.status === 'reported' && (
                    <Button
                      className="w-full"
                      onClick={() => handleMatchGuest(selectedItem.id)}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Match to Guest
                    </Button>
                  )}
                  {(selectedItem.status === 'reported' || selectedItem.status === 'matched') && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleReturn(selectedItem.id)}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Mark as Returned
                    </Button>
                  )}
                  {selectedItem.status !== 'disposed' && selectedItem.status !== 'returned' && (
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => handleDispose(selectedItem.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Mark as Disposed
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
