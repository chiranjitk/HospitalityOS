'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  Plus,
  Edit,
  Eye,
  Send,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Search,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
}

interface Review {
  id: string;
  userId: string;
  reviewPeriod: string;
  reviewYear: number;
  reviewDate: string;
  overallRating: number | null;
  punctualityRating: number | null;
  qualityRating: number | null;
  teamworkRating: number | null;
  communicationRating: number | null;
  initiativeRating: number | null;
  tasksCompleted: number;
  attendanceRate: number | null;
  goalsSet: number;
  goalsAchieved: number;
  goalsComments: string | null;
  strengths: string | null;
  areasOfImprovement: string | null;
  achievements: string | null;
  employeeComments: string | null;
  status: string;
  acknowledgedAt: string | null;
  user: { id: string; firstName: string; lastName: string; department: string; jobTitle: string } | null;
}

type RatingKey = 'punctualityRating' | 'qualityRating' | 'teamworkRating' | 'communicationRating' | 'initiativeRating';

const RATING_CATEGORIES: { key: RatingKey; label: string; icon: React.ElementType }[] = [
  { key: 'punctualityRating', label: 'Punctuality', icon: Clock },
  { key: 'qualityRating', label: 'Work Quality', icon: CheckCircle },
  { key: 'teamworkRating', label: 'Teamwork', icon: User },
  { key: 'communicationRating', label: 'Communication', icon: FileText },
  { key: 'initiativeRating', label: 'Initiative', icon: Star },
];

const STATUS_FLOW = ['draft', 'submitted', 'approved', 'acknowledged'];

const statusVariant: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  acknowledged: 'bg-primary/15 text-primary',
};

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  acknowledged: 'Acknowledged',
};

/* ─── Star Rating Component ─── */
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn('transition-colors', readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110')}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => onChange?.(star)}
        >
          <Star
            className={cn(
              sizeClass,
              (hovered || value) >= star
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export default function PerformanceReviews() {
  const t = useTranslations('staff');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    reviewPeriod: 'Q1',
    reviewYear: String(new Date().getFullYear()),
    punctualityRating: 0,
    qualityRating: 0,
    teamworkRating: 0,
    communicationRating: 0,
    initiativeRating: 0,
    tasksCompleted: 0,
    attendanceRate: '',
    goalsSet: 0,
    goalsAchieved: 0,
    goalsComments: '',
    strengths: '',
    areasOfImprovement: '',
    achievements: '',
    employeeComments: '',
    nextReviewDate: '',
    status: 'draft',
  });

  const resetForm = () => {
    setFormData({
      userId: '',
      reviewPeriod: 'Q1',
      reviewYear: String(new Date().getFullYear()),
      punctualityRating: 0,
      qualityRating: 0,
      teamworkRating: 0,
      communicationRating: 0,
      initiativeRating: 0,
      tasksCompleted: 0,
      attendanceRate: '',
      goalsSet: 0,
      goalsAchieved: 0,
      goalsComments: '',
      strengths: '',
      areasOfImprovement: '',
      achievements: '',
      employeeComments: '',
      nextReviewDate: '',
      status: 'draft',
    });
    setSelectedReview(null);
  };

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ action: 'reviews' });
      const res = await fetch(`/api/staff/performance?${params}`);
      const result = await res.json();
      if (result.success) {
        setReviews(result.data || []);
      }
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      setStaffLoading(true);
      const res = await fetch('/api/users');
      const result = await res.json();
      if (result.users) {
        setStaff(result.users.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          department: u.department || 'General',
          jobTitle: u.jobTitle || 'Staff',
        })));
      }
    } catch {
      // Silently fail
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchReviews(), fetchStaff()]);
    };
    void init();
  }, []);

  const filteredReviews = useMemo(() => {
    let filtered = reviews;
    if (filterStatus !== 'all') {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.user?.firstName?.toLowerCase().includes(q) ||
          r.user?.lastName?.toLowerCase().includes(q) ||
          r.user?.department?.toLowerCase().includes(q) ||
          r.reviewPeriod.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [reviews, filterStatus, searchQuery]);

  const handleCreateReview = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditReview = (review: Review) => {
    setSelectedReview(review);
    setFormData({
      userId: review.userId,
      reviewPeriod: review.reviewPeriod,
      reviewYear: String(review.reviewYear),
      punctualityRating: review.punctualityRating || 0,
      qualityRating: review.qualityRating || 0,
      teamworkRating: review.teamworkRating || 0,
      communicationRating: review.communicationRating || 0,
      initiativeRating: review.initiativeRating || 0,
      tasksCompleted: review.tasksCompleted,
      attendanceRate: review.attendanceRate ? String(review.attendanceRate) : '',
      goalsSet: review.goalsSet,
      goalsAchieved: review.goalsAchieved,
      goalsComments: review.goalsComments || '',
      strengths: review.strengths || '',
      areasOfImprovement: review.areasOfImprovement || '',
      achievements: review.achievements || '',
      employeeComments: review.employeeComments || '',
      nextReviewDate: review.nextReviewDate ? new Date(review.nextReviewDate).toISOString().split('T')[0] : '',
      status: review.status,
    });
    setIsDialogOpen(true);
  };

  const handleViewReview = (review: Review) => {
    setSelectedReview(review);
    setIsViewOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) {
      toast.error('Please select a staff member');
      return;
    }

    const avgRating =
      RATING_CATEGORIES.reduce((sum, cat) => sum + (formData[cat.key] || 0), 0) / RATING_CATEGORIES.length;

    try {
      setIsSubmitting(true);

      if (selectedReview) {
        // Update
        const res = await fetch('/api/staff/performance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'review',
            id: selectedReview.id,
            ...Object.fromEntries(
              RATING_CATEGORIES.map((cat) => [cat.key, formData[cat.key] || null])
            ),
            overallRating: Math.round(avgRating * 10) / 10,
            tasksCompleted: formData.tasksCompleted,
            attendanceRate: formData.attendanceRate ? parseFloat(formData.attendanceRate) : null,
            goalsSet: formData.goalsSet,
            goalsAchieved: formData.goalsAchieved,
            goalsComments: formData.goalsComments || null,
            strengths: formData.strengths || null,
            areasOfImprovement: formData.areasOfImprovement || null,
            achievements: formData.achievements || null,
            employeeComments: formData.employeeComments || null,
            nextReviewDate: formData.nextReviewDate || null,
            status: formData.status,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Failed to update');
        }

        toast.success('Review updated successfully');
      } else {
        // Create
        const res = await fetch('/api/staff/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'review',
            userId: formData.userId,
            reviewPeriod: formData.reviewPeriod,
            reviewYear: formData.reviewYear,
            ...Object.fromEntries(
              RATING_CATEGORIES.map((cat) => [cat.key, formData[cat.key] || null])
            ),
            overallRating: Math.round(avgRating * 10) / 10,
            tasksCompleted: formData.tasksCompleted,
            attendanceRate: formData.attendanceRate ? parseFloat(formData.attendanceRate) : null,
            goalsSet: formData.goalsSet,
            goalsAchieved: formData.goalsAchieved,
            goalsComments: formData.goalsComments || null,
            strengths: formData.strengths || null,
            areasOfImprovement: formData.areasOfImprovement || null,
            achievements: formData.achievements || null,
            employeeComments: formData.employeeComments || null,
            nextReviewDate: formData.nextReviewDate || null,
            status: formData.status,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Failed to create');
        }

        toast.success('Review created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchReviews();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (review: Review, newStatus: string) => {
    try {
      const res = await fetch('/api/staff/performance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', id: review.id, status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success(`Review ${statusLabel[newStatus]?.toLowerCase() || newStatus}`);
      fetchReviews();
    } catch {
      toast.error('Failed to update review status');
    }
  };

  const currentStatusIdx = selectedReview
    ? STATUS_FLOW.indexOf(selectedReview.status)
    : -1;
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIdx + 1]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Performance Reviews</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage staff performance evaluations
          </p>
        </div>
        <Button onClick={handleCreateReview} className="gap-2">
          <Plus className="h-4 w-4" />
          New Review
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, period..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No reviews found</p>
            <Button variant="outline" className="mt-4" onClick={handleCreateReview}>
              Create First Review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {filteredReviews.map((review) => (
              <Card key={review.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-500 text-white text-sm">
                          {review.user?.firstName?.[0]}{review.user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {review.user?.firstName} {review.user?.lastName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{review.user?.department}</span>
                          <span>&middot;</span>
                          <span>{review.reviewPeriod} {review.reviewYear}</span>
                          <span>&middot;</span>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusVariant[review.status])}>
                            {statusLabel[review.status]}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {review.overallRating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-sm">{review.overallRating.toFixed(1)}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewReview(review)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {review.status !== 'acknowledged' && (
                          <Button variant="ghost" size="sm" onClick={() => handleEditReview(review)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {nextStatus && STATUS_FLOW.indexOf(review.status) >= 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              handleStatusChange(review, STATUS_FLOW[STATUS_FLOW.indexOf(review.status) + 1])
                            }
                          >
                            {review.status === 'draft' && <Send className="h-3 w-3" />}
                            {review.status === 'submitted' && <CheckCircle className="h-3 w-3" />}
                            {review.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                            <span className="text-xs">
                              {review.status === 'draft' && 'Submit'}
                              {review.status === 'submitted' && 'Approve'}
                              {review.status === 'approved' && 'Acknowledge'}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rating breakdown */}
                  {review.overallRating && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-3">
                      {RATING_CATEGORIES.map((cat) => {
                        const val = review[cat.key];
                        if (val == null) return null;
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className="flex items-center gap-1.5 text-xs">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{cat.label}:</span>
                            <StarRating value={val} readonly size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReview ? 'Edit Performance Review' : 'Create Performance Review'}</DialogTitle>
            <DialogDescription>
              {selectedReview ? 'Update the review ratings and comments.' : 'Evaluate a staff member across key performance categories.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Staff member and period */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Staff Member *</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, userId: v }))}
                  disabled={!!selectedReview}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Review Period</Label>
                <Select
                  value={formData.reviewPeriod}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, reviewPeriod: v }))}
                  disabled={!!selectedReview}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                    <SelectItem value="H1">H1</SelectItem>
                    <SelectItem value="H2">H2</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={formData.reviewYear}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, reviewYear: v }))}
                  disabled={!!selectedReview}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Star Ratings */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Performance Ratings</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                {RATING_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">{cat.label}</span>
                      </div>
                      <StarRating
                        value={formData[cat.key]}
                        onChange={(v) => setFormData((prev) => ({ ...prev, [cat.key]: v }))}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Computed overall */}
              {(() => {
                const avg =
                  RATING_CATEGORIES.reduce((sum, cat) => sum + formData[cat.key], 0) / RATING_CATEGORIES.length;
                return avg > 0 ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                    <span className="font-semibold text-sm">Overall Rating (auto-calculated)</span>
                    <div className="flex items-center gap-2">
                      <StarRating value={Math.round(avg)} readonly size="md" />
                      <span className="font-bold text-lg">{avg.toFixed(1)}</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tasks Completed</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.tasksCompleted}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tasksCompleted: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Attendance Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 95"
                  value={formData.attendanceRate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, attendanceRate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Goals Set</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.goalsSet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, goalsSet: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Goals Achieved</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.goalsAchieved}
                  onChange={(e) => setFormData((prev) => ({ ...prev, goalsAchieved: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Comments & Feedback</Label>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Strengths</Label>
                  <Textarea
                    rows={2}
                    placeholder="Key strengths and accomplishments..."
                    value={formData.strengths}
                    onChange={(e) => setFormData((prev) => ({ ...prev, strengths: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Areas for Improvement</Label>
                  <Textarea
                    rows={2}
                    placeholder="Areas where improvement is needed..."
                    value={formData.areasOfImprovement}
                    onChange={(e) => setFormData((prev) => ({ ...prev, areasOfImprovement: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Achievements</Label>
                  <Textarea
                    rows={2}
                    placeholder="Notable achievements during the review period..."
                    value={formData.achievements}
                    onChange={(e) => setFormData((prev) => ({ ...prev, achievements: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Goals Comments</Label>
                  <Textarea
                    rows={2}
                    placeholder="Notes on goals progress..."
                    value={formData.goalsComments}
                    onChange={(e) => setFormData((prev) => ({ ...prev, goalsComments: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Employee Comments</Label>
                  <Textarea
                    rows={2}
                    placeholder="Employee's self-assessment or comments..."
                    value={formData.employeeComments}
                    onChange={(e) => setFormData((prev) => ({ ...prev, employeeComments: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Next review date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Review Date</Label>
                <Input
                  type="date"
                  value={formData.nextReviewDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nextReviewDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : selectedReview ? (
                  'Update Review'
                ) : (
                  'Create Review'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── View Review Dialog ─── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              {selectedReview?.user?.firstName} {selectedReview?.user?.lastName} &mdash; {selectedReview?.reviewPeriod} {selectedReview?.reviewYear}
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-5">
              {/* Status bar */}
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_FLOW.map((s, idx) => (
                  <React.Fragment key={s}>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        STATUS_FLOW.indexOf(selectedReview.status) >= idx
                          ? statusVariant[s]
                          : 'opacity-40'
                      )}
                    >
                      {statusLabel[s]}
                    </Badge>
                    {idx < STATUS_FLOW.length - 1 && (
                      <span className="text-muted-foreground text-xs">&rarr;</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Overall rating */}
              {selectedReview.overallRating && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border">
                  <span className="font-semibold">Overall:</span>
                  <StarRating value={Math.round(selectedReview.overallRating)} readonly size="lg" />
                  <span className="text-2xl font-bold">{selectedReview.overallRating.toFixed(1)}</span>
                </div>
              )}

              {/* Category ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RATING_CATEGORIES.map((cat) => {
                  const val = selectedReview[cat.key];
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {val != null ? (
                          <>
                            <StarRating value={val} readonly size="sm" />
                            <span className="text-sm font-semibold">{val.toFixed(1)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{selectedReview.tasksCompleted}</p>
                  <p className="text-xs text-muted-foreground">Tasks Completed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{selectedReview.attendanceRate ?? 'N/A'}%</p>
                  <p className="text-xs text-muted-foreground">Attendance</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{selectedReview.goalsAchieved}/{selectedReview.goalsSet}</p>
                  <p className="text-xs text-muted-foreground">Goals</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedReview.reviewDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Reviewed On</p>
                </div>
              </div>

              {/* Comments sections */}
              {selectedReview.strengths && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Strengths</Label>
                  <p className="text-sm bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-3">
                    {selectedReview.strengths}
                  </p>
                </div>
              )}
              {selectedReview.areasOfImprovement && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400">Areas for Improvement</Label>
                  <p className="text-sm bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-3">
                    {selectedReview.areasOfImprovement}
                  </p>
                </div>
              )}
              {selectedReview.achievements && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-primary">Achievements</Label>
                  <p className="text-sm bg-primary/5 rounded-lg p-3">
                    {selectedReview.achievements}
                  </p>
                </div>
              )}
              {selectedReview.goalsComments && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Goals Comments</Label>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedReview.goalsComments}</p>
                </div>
              )}
              {selectedReview.employeeComments && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Employee Comments</Label>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedReview.employeeComments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
