'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Star,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  MessageSquare,
  Reply,
  Eye,
  EyeOff,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface FeedbackItem {
  id: string;
  experienceBookingId: string | null;
  experienceId: string;
  guestId: string | null;
  guestName: string;
  rating: number;
  reviewText: string | null;
  category: string | null;
  staffResponse: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  experience: { id: string; name: string };
}

interface RatingDist {
  rating: number;
  count: number;
}

interface AvgByExperience {
  experienceId: string;
  experienceName: string;
  avgRating: number;
  totalReviews: number;
}

const categories = ['quality', 'value', 'service', 'cleanliness', 'amenities', 'location', 'overall'];

function StarRating({ rating, onChange, size = 'sm', readOnly = false }: { rating: number; onChange?: (r: number) => void; size?: 'sm' | 'md' | 'lg'; readOnly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={cn(
            'transition-colors',
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              (hovered || rating) >= star
                ? 'text-amber-500 fill-amber-500'
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
        </button>
      ))}
    </div>
  );
}

const statusBadgeClasses: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  hidden: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export default function ExperienceFeedback() {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [ratingDist, setRatingDist] = useState<RatingDist[]>([]);
  const [avgByExp, setAvgByExp] = useState<AvgByExperience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    experienceId: '',
    guestName: '',
    rating: 5,
    reviewText: '',
    category: '',
    staffResponse: '',
  });

  const [replyText, setReplyText] = useState('');

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (ratingFilter !== 'all') params.append('rating', ratingFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/experience-feedback?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setFeedback(result.data);
        setRatingDist(result.stats.ratingDistribution);
        setAvgByExp(result.stats.averageByExperience);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch feedback',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, ratingFilter, statusFilter, toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleCreate = async () => {
    if (!createForm.experienceId || !createForm.guestName) {
      toast({
        title: 'Validation Error',
        description: 'Please select an experience and enter guest name',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/experience-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Feedback created successfully' });
        setIsCreateOpen(false);
        setCreateForm({ experienceId: '', guestName: '', rating: 5, reviewText: '', category: '', staffResponse: '' });
        fetchFeedback();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create feedback',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create feedback', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReply = async () => {
    if (!selectedFeedback || !replyText.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/experience-feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedFeedback.id, staffResponse: replyText }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Reply added successfully' });
        setIsReplyOpen(false);
        setReplyText('');
        fetchFeedback();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add reply', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (item: FeedbackItem) => {
    const newStatus = item.status === 'published' ? 'hidden' : 'published';
    try {
      const response = await fetch('/api/experience-feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: `Feedback ${newStatus === 'published' ? 'published' : 'hidden'}` });
        fetchFeedback();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      const response = await fetch(`/api/experience-feedback?id=${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Feedback deleted' });
        fetchFeedback();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete feedback', variant: 'destructive' });
    }
  };

  const totalReviews = ratingDist.reduce((sum, r) => sum + r.count, 0);
  const overallAvg = ratingDist.length > 0
    ? ratingDist.reduce((sum, r) => sum + r.rating * r.count, 0) / totalReviews
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Guest Feedback & Ratings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest reviews and feedback for experiences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFeedback}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Feedback
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{overallAvg.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Average Rating</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalReviews}</div>
              <div className="text-xs text-muted-foreground">Total Reviews</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Star className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{ratingDist.find(r => r.rating === 5)?.count || 0}</div>
              <div className="text-xs text-muted-foreground">5-Star Reviews</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <MessageSquare className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{feedback.filter(f => !f.staffResponse).length}</div>
              <div className="text-xs text-muted-foreground">Awaiting Reply</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Rating Distribution + Avg by Experience */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const item = ratingDist.find(r => r.rating === star);
              const count = item?.count || 0;
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium">{star}</span>
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Average by Experience</CardTitle>
          </CardHeader>
          <CardContent>
            {avgByExp.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No reviews yet
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {avgByExp.map(exp => (
                  <div key={exp.experienceId} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{exp.experienceName}</p>
                      <p className="text-xs text-muted-foreground">{exp.totalReviews} reviews</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <StarRating rating={Math.round(exp.avgRating)} readOnly />
                      <span className="text-sm font-bold">{exp.avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest or review..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={String(r)}>{r} Star{r > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mb-4" />
              <p>No feedback found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead className="hidden sm:table-cell">Experience</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.guestName}</p>
                          {item.reviewText && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">
                              {item.reviewText}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{item.experience.name}</span>
                      </TableCell>
                      <TableCell>
                        <StarRating rating={item.rating} readOnly />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.category ? (
                          <Badge variant="secondary" className="capitalize">{item.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', statusBadgeClasses[item.status])}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!item.staffResponse && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reply" onClick={() => { setSelectedFeedback(item); setIsReplyOpen(true); }}>
                              <Reply className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={item.status === 'published' ? 'Hide' : 'Publish'} onClick={() => toggleStatus(item)}>
                            {item.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Delete" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Feedback Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feedback</DialogTitle>
            <DialogDescription>Submit guest feedback for an experience</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Experience</Label>
              <Input
                placeholder="Experience ID"
                value={createForm.experienceId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, experienceId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input
                placeholder="Guest name"
                value={createForm.guestName}
                onChange={(e) => setCreateForm(prev => ({ ...prev, guestName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <StarRating rating={createForm.rating} onChange={(r) => setCreateForm(prev => ({ ...prev, rating: r }))} size="lg" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={createForm.category} onValueChange={(v) => setCreateForm(prev => ({ ...prev, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Review</Label>
              <Textarea
                placeholder="Guest review text..."
                value={createForm.reviewText}
                onChange={(e) => setCreateForm(prev => ({ ...prev, reviewText: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Feedback</DialogTitle>
            <DialogDescription>
              Replying to {selectedFeedback?.guestName}&apos;s review
            </DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{selectedFeedback.guestName}</span>
                  <StarRating rating={selectedFeedback.rating} readOnly />
                </div>
                {selectedFeedback.reviewText && (
                  <p className="text-sm text-muted-foreground">{selectedFeedback.reviewText}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Staff Response</Label>
                <Textarea
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
            <Button onClick={handleReply} disabled={isSaving || !replyText.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
