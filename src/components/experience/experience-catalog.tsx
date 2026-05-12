'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Compass,
  Plus,
  Search,
  Edit,
  Trash2,
  Star,
  Clock,
  Users,
  DollarSign,
  Filter,
  Loader2,
  Eye,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Adventure',
  'Wellness',
  'Dining',
  'Cultural',
  'Water Sports',
  'Nature',
  'Entertainment',
  'Transportation',
  'Custom',
];

const STATUSES = ['active', 'inactive', 'archived'];

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-gray-500',
  archived: 'bg-red-500',
};

const statusBadgeClass: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  archived: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const categoryIcons: Record<string, string> = {
  Adventure: '🏔️',
  Wellness: '🧘',
  Dining: '🍽️',
  Cultural: '🎭',
  'Water Sports': '🏄',
  Nature: '🌿',
  Entertainment: '🎭',
  Transportation: '🚗',
  Custom: '⭐',
};

// ── Types ──────────────────────────────────────────────────────────────

interface Experience {
  id: string;
  name: string;
  description?: string;
  category?: string;
  duration: number;
  maxParticipants: number;
  basePrice: number;
  imageUrl?: string;
  status: string;
  tags?: string;
  highlights?: string;
  whatToBring?: string;
  cancellationPolicy?: string;
  rating: number;
  totalReviews: number;
  totalBookings: number;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  totalRevenue: number;
  avgRating: number;
}

interface Pagination {
  page: number | null;
  limit: number | null;
  total: number;
}

// ── Default form state ─────────────────────────────────────────────────

const defaultForm = {
  name: '',
  description: '',
  category: '',
  duration: 60,
  maxParticipants: 10,
  basePrice: 0,
  imageUrl: '',
  status: 'active',
  tags: '',
  highlights: '',
  whatToBring: '',
  cancellationPolicy: '',
};

// ── Helpers ────────────────────────────────────────────────────────────

function parseList(val?: string): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fall through
  }
  return val
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTags(val?: string): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fall through
  }
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Component ──────────────────────────────────────────────────────────

export default function ExperienceCatalog() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [page, setPage] = useState(1);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Track previous filter values to auto-reset page
  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState(debouncedSearch);
  const [prevCategoryFilter, setPrevCategoryFilter] = useState(categoryFilter);
  const [prevStatusFilter, setPrevStatusFilter] = useState(statusFilter);

  // Auto-reset page when filters change
  if (
    debouncedSearch !== prevDebouncedSearch ||
    categoryFilter !== prevCategoryFilter ||
    statusFilter !== prevStatusFilter
  ) {
    setPrevDebouncedSearch(debouncedSearch);
    setPrevCategoryFilter(categoryFilter);
    setPrevStatusFilter(statusFilter);
    setPage(1);
  }

  // Fetch experiences
  const fetchExperiences = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', String(page));
      params.append('limit', '50');

      const res = await fetch(`/api/experiences?${params}`);
      const result = await res.json();

      if (result.success) {
        setExperiences(result.data || []);
        if (result.stats) setStats(result.stats);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch experiences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, categoryFilter, statusFilter, page, toast]);

  /* eslint-disable react-hooks/set-state-in-effect -- data fetching requires calling setState after fetch */
  useEffect(() => {
    fetchExperiences();
  }, [debouncedSearch, categoryFilter, statusFilter, page]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── CRUD handlers ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (formData.duration <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Duration must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    if (formData.basePrice < 0) {
      toast({
        title: 'Validation Error',
        description: 'Base price must be 0 or greater',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Experience created successfully' });
        setIsCreateOpen(false);
        setFormData(defaultForm);
        fetchExperiences();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create experience',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create experience',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedExperience?.id) return;
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    if (formData.duration <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Duration must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    if (formData.basePrice < 0) {
      toast({
        title: 'Validation Error',
        description: 'Base price must be 0 or greater',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/experiences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedExperience.id, ...formData }),
      });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Experience updated successfully' });
        setIsEditOpen(false);
        setSelectedExperience(null);
        fetchExperiences();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update experience',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update experience',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExperience?.id) return;
    try {
      const res = await fetch('/api/experiences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedExperience.id }),
      });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Experience archived successfully' });
        setIsDeleteOpen(false);
        setSelectedExperience(null);
        fetchExperiences();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete experience',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete experience',
        variant: 'destructive',
      });
    }
  };

  // ── Dialog helpers ─────────────────────────────────────────────────

  const openEdit = (exp: Experience) => {
    setSelectedExperience(exp);
    setFormData({
      name: exp.name,
      description: exp.description || '',
      category: exp.category || '',
      duration: exp.duration,
      maxParticipants: exp.maxParticipants,
      basePrice: exp.basePrice,
      imageUrl: exp.imageUrl || '',
      status: exp.status,
      tags: parseTags(exp.tags).join(', '),
      highlights: parseList(exp.highlights).join('\n'),
      whatToBring: parseList(exp.whatToBring).join('\n'),
      cancellationPolicy: exp.cancellationPolicy || '',
    });
    setIsEditOpen(true);
  };

  const openDetail = (exp: Experience) => {
    setSelectedExperience(exp);
    setIsDetailOpen(true);
  };

  const openDelete = (exp: Experience) => {
    setSelectedExperience(exp);
    setIsDeleteOpen(true);
  };

  // ── Render helpers ─────────────────────────────────────────────────

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {rating > 0 && (
        <span className="text-xs text-muted-foreground">({experiences.find((e) => e.rating === rating)?.totalReviews || 0})</span>
      )}
    </div>
  );

  const renderStatCards = () => (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <Compass className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats?.total ?? <Skeleton className="h-7 w-8" />}</div>
            <div className="text-xs text-muted-foreground">Total Experiences</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Star className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats?.active ?? <Skeleton className="h-7 w-8" />}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <DollarSign className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {stats?.totalRevenue != null ? formatCurrency(stats.totalRevenue) : <Skeleton className="h-7 w-12 inline-block" />}
            </div>
            <div className="text-xs text-muted-foreground">Total Revenue</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Star className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats?.avgRating != null ? stats.avgRating.toFixed(1) : <Skeleton className="h-7 w-8" />}</div>
            <div className="text-xs text-muted-foreground">Avg Rating</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Skeleton loader ────────────────────────────────────────────────

  const renderLoadingSkeleton = () => (
    <div className="space-y-6">
      {renderStatCards()}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-5 w-16" />
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────

  if (isLoading && !experiences.length) {
    return renderLoadingSkeleton();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Compass className="h-5 w-5" />
            Experience Catalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage hotel experiences and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchExperiences}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setFormData(defaultForm);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Experience
          </Button>
        </div>
      </div>

      {/* Stats */}
      {renderStatCards()}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search experiences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="flex justify-between pt-2">
                      <Skeleton className="h-5 w-16" />
                      <div className="flex gap-1">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Compass className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No experiences found</p>
              <p className="text-sm mt-1">
                {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first experience to get started'}
              </p>
              {!searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
                <Button
                  className="mt-4"
                  onClick={() => {
                    setFormData(defaultForm);
                    setIsCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Experience
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── Grid View ─────────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Image */}
                  {exp.imageUrl ? (
                    <div className="relative h-36 bg-muted overflow-hidden">
                      <img
                        src={exp.imageUrl}
                        alt={exp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', statusBadgeClass[exp.status])}
                        >
                          {exp.status}
                        </Badge>
                      </div>
                      {exp.rating > 0 && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white rounded-md px-2 py-1 text-xs">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          {exp.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-24 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
                      <Compass className="h-8 w-8 text-muted-foreground/50" />
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', statusBadgeClass[exp.status])}
                        >
                          {exp.status}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium line-clamp-1">{exp.name}</h3>
                    </div>

                    {exp.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {exp.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {exp.category && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <span>{categoryIcons[exp.category] || '⭐'}</span>
                          {exp.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(exp.duration)}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Users className="h-3 w-3" />
                        {exp.maxParticipants}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="font-semibold text-lg">{formatCurrency(exp.basePrice)}</span>
                        <span className="text-xs text-muted-foreground ml-1">/ person</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {exp.totalBookings} bookings
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openDetail(exp)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openEdit(exp)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => openDelete(exp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Table View (Desktop) ─────────────────────────────────── */
            <>
              <div className="hidden sm:block">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Experience</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Bookings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {experiences.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {exp.imageUrl ? (
                                <img
                                  src={exp.imageUrl}
                                  alt={exp.name}
                                  className="h-10 w-10 rounded-md object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                  <Compass className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{exp.name}</p>
                                {exp.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {exp.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {exp.category ? (
                              <Badge variant="outline" className="text-xs gap-1">
                                <span>{categoryIcons[exp.category] || '⭐'}</span>
                                {exp.category}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDuration(exp.duration)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(exp.basePrice)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                              <span className="text-sm">{exp.rating.toFixed(1)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {exp.totalBookings}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', statusBadgeClass[exp.status])}
                            >
                              {exp.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => openDetail(exp)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => openEdit(exp)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-red-500 hover:text-red-600"
                                onClick={() => openDelete(exp)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* ── Mobile list for table mode ──────────────────────────── */}
              <div className="sm:hidden space-y-3 p-4">
                {experiences.map((exp) => (
                  <div key={exp.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{exp.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {exp.description}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs ml-2 shrink-0', statusBadgeClass[exp.status])}
                      >
                        {exp.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {exp.category && (
                        <Badge variant="outline" className="text-xs gap-1">
                          {categoryIcons[exp.category]} {exp.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(exp.duration)}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        {formatCurrency(exp.basePrice)}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        {exp.rating.toFixed(1)}
                      </Badge>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openDetail(exp)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => openEdit(exp)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => openDelete(exp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination info */}
          {pagination && pagination.total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>Showing up to 50 of {pagination.total} results</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create/Edit Dialog ──────────────────────────────────────── */}
      <Dialog
        open={isCreateOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setIsEditOpen(false);
            setSelectedExperience(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Experience' : 'Create Experience'}
            </DialogTitle>
            <DialogDescription>
              {isEditOpen
                ? 'Update experience details'
                : 'Add a new experience to your catalog'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-4 py-4">
              {/* Row 1: Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="exp-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Sunset Beach Yoga"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, category: v }))
                    }
                  >
                    <SelectTrigger id="exp-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {categoryIcons[c] || '⭐'} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Description */}
              <div className="space-y-2">
                <Label htmlFor="exp-desc">Description</Label>
                <Textarea
                  id="exp-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="Describe the experience..."
                />
              </div>

              {/* Row 3: Duration, Max Guests, Base Price, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-duration">Duration (min)</Label>
                  <Input
                    id="exp-duration"
                    type="number"
                    min={1}
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        duration: parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-guests">Max Participants</Label>
                  <Input
                    id="exp-guests"
                    type="number"
                    min={1}
                    value={formData.maxParticipants}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        maxParticipants: parseInt(e.target.value) || 10,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-price">Base Price ($)</Label>
                  <Input
                    id="exp-price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.basePrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        basePrice: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, status: v }))
                    }
                  >
                    <SelectTrigger id="exp-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: Image URL */}
              <div className="space-y-2">
                <Label htmlFor="exp-image">Image URL</Label>
                <Input
                  id="exp-image"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* Row 5: Tags */}
              <div className="space-y-2">
                <Label htmlFor="exp-tags">Tags (comma-separated)</Label>
                <Input
                  id="exp-tags"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, tags: e.target.value }))
                  }
                  placeholder="spa, luxury, couples, outdoor"
                />
              </div>

              {/* Row 6: Highlights */}
              <div className="space-y-2">
                <Label htmlFor="exp-highlights">
                  Highlights <span className="text-xs text-muted-foreground">(one per line)</span>
                </Label>
                <Textarea
                  id="exp-highlights"
                  value={formData.highlights}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, highlights: e.target.value }))
                  }
                  rows={4}
                  placeholder={`Scenic ocean views\nProfessional certified guide\nRefreshments included`}
                />
              </div>

              {/* Row 7: What to Bring */}
              <div className="space-y-2">
                <Label htmlFor="exp-bring">
                  What to Bring <span className="text-xs text-muted-foreground">(one per line)</span>
                </Label>
                <Textarea
                  id="exp-bring"
                  value={formData.whatToBring}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, whatToBring: e.target.value }))
                  }
                  rows={3}
                  placeholder={`Sunscreen\nComfortable walking shoes\nSwimwear`}
                />
              </div>

              {/* Row 8: Cancellation Policy */}
              <div className="space-y-2">
                <Label htmlFor="exp-cancel">Cancellation Policy</Label>
                <Textarea
                  id="exp-cancel"
                  value={formData.cancellationPolicy}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      cancellationPolicy: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Free cancellation up to 24 hours before the experience. 50% charge for late cancellations."
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
                setSelectedExperience(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ───────────────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Experience Details</DialogTitle>
          </DialogHeader>
          {selectedExperience && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {/* Header with image */}
                {selectedExperience.imageUrl ? (
                  <div className="rounded-lg overflow-hidden h-48">
                    <img
                      src={selectedExperience.imageUrl}
                      alt={selectedExperience.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-24 bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center">
                    <Compass className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold">
                    {selectedExperience.name}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn(statusBadgeClass[selectedExperience.status])}
                  >
                    {selectedExperience.status}
                  </Badge>
                </div>

                {selectedExperience.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedExperience.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium">
                      {selectedExperience.category
                        ? `${categoryIcons[selectedExperience.category] || ''} ${selectedExperience.category}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(selectedExperience.duration)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Guests:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {selectedExperience.maxParticipants}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span>
                    <p className="font-medium">
                      ${selectedExperience.basePrice.toFixed(2)} / person
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rating:</span>
                    <p className="font-medium flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      {selectedExperience.rating.toFixed(1)}{' '}
                      <span className="text-muted-foreground">
                        ({selectedExperience.totalReviews} reviews)
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bookings:</span>
                    <p className="font-medium">
                      {selectedExperience.totalBookings}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                {parseTags(selectedExperience.tags).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {parseTags(selectedExperience.tags).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Highlights */}
                {parseList(selectedExperience.highlights).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Highlights:
                    </span>
                    <ul className="mt-1 space-y-1">
                      {parseList(selectedExperience.highlights).map((h, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Star className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What to Bring */}
                {parseList(selectedExperience.whatToBring).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      What to Bring:
                    </span>
                    <ul className="mt-1 space-y-1">
                      {parseList(selectedExperience.whatToBring).map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cancellation Policy */}
                {selectedExperience.cancellationPolicy && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Cancellation Policy:
                    </span>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg">
                      {selectedExperience.cancellationPolicy}
                    </p>
                  </div>
                )}

                {/* Created date */}
                <div className="text-xs text-muted-foreground">
                  Created on{' '}
                  {format(new Date(selectedExperience.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Experience</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{selectedExperience?.name}
              &quot;? This will set the experience to archived status. You can
              reactivate it later by editing its status.
              {selectedExperience?.status === 'active' &&
                selectedExperience?.totalBookings > 0 &&
                ` This experience has ${selectedExperience.totalBookings} active bookings.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
