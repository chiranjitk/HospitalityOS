'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Star, MessageSquare, Reply, ThumbsUp, ThumbsDown, Minus,
  Globe, Loader2, Plus, Search, Filter, TrendingUp,
  CheckCircle2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: string;
  platform: string;
  authorName: string;
  rating: number;
  title: string | null;
  content: string | null;
  reviewDate: string | null;
  responseText: string | null;
  respondedAt: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  categories: string[];
  isFeatured: boolean;
}

interface Aggregates {
  totalReviews: number;
  overallAvgRating: number;
  responseRate: number;
  platformRatings: Record<string, { count: number; avg: number }>;
  sentimentDistribution: Record<string, number>;
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  google: { icon: 'G', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Google' },
  tripadvisor: { icon: 'T', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', label: 'TripAdvisor' },
  booking: { icon: 'B', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300', label: 'Booking.com' },
  expedia: { icon: 'E', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Expedia' },
  agoda: { icon: 'A', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Agoda' },
  facebook: { icon: 'F', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300', label: 'Facebook' },
  yelp: { icon: 'Y', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300', label: 'Yelp' },
};

const SENTIMENT_CONFIG: Record<string, { color: string; icon: typeof ThumbsUp }> = {
  positive: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', icon: ThumbsUp },
  neutral: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Minus },
  negative: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: ThumbsDown },
  mixed: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: Minus },
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    cleanliness: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
    service: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
    location: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
    value: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    rooms: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    food: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300',
  };
  return (
    <Badge className={`${colors[category] || 'bg-gray-100 text-gray-800'} text-xs`} variant="secondary">
      {category}
    </Badge>
  );
}

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<string>('all');
  const [respondingTo, setRespondingTo] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [suggestedTone, setSuggestedTone] = useState<{ reviewSentiment: string; suggestedTone: string; categories: string[] } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newReview, setNewReview] = useState({ platform: 'google', authorName: '', rating: 5, title: '', content: '' });

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activePlatform !== 'all') params.set('platform', activePlatform);
      params.set('limit', '100');
      const res = await fetch(`/api/guests/reviews?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      if (json.success) {
        setReviews(json.data);
        setAggregates(json.aggregates);
      }
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [activePlatform]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleRespond = async () => {
    if (!respondingTo || !responseText.trim()) return;
    try {
      setSubmittingResponse(true);
      const res = await fetch(`/api/guests/reviews/${respondingTo.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText }),
      });
      const json = await res.json();
      if (json.success) {
        setSuggestedTone(json.toneSuggestion);
        toast.success('Response submitted successfully');
        setRespondingTo(null);
        setResponseText('');
        fetchReviews();
      } else {
        toast.error(json.error?.message || 'Failed to respond');
      }
    } catch {
      toast.error('Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleOpenRespond = (review: Review) => {
    setRespondingTo(review);
    setResponseText('');
    setSuggestedTone(null);
  };

  const handleAddReview = async () => {
    if (!newReview.authorName.trim()) {
      toast.error('Author name is required');
      return;
    }
    try {
      const res = await fetch('/api/guests/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newReview,
          propertyId: 'default', // Will use tenant default
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Review added');
        setAddDialogOpen(false);
        setNewReview({ platform: 'google', authorName: '', rating: 5, title: '', content: '' });
        fetchReviews();
      } else {
        toast.error(json.error?.message || 'Failed to add review');
      }
    } catch {
      toast.error('Failed to add review');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Online Review Management</h1>
          <p className="text-muted-foreground">Monitor and respond to guest reviews across platforms</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchReviews}>
            <Filter className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add Review
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {aggregates && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Avg Rating</span>
              </div>
              <div className="text-3xl font-bold">{aggregates.overallAvgRating}</div>
              <p className="text-xs text-muted-foreground">{aggregates.totalReviews} total reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Reply className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Response Rate</span>
              </div>
              <div className="text-3xl font-bold">{aggregates.responseRate}%</div>
              <div className="flex items-center gap-1 mt-1">
                {aggregates.responseRate >= 80 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-3 w-3 text-amber-600" />
                )}
                <span className={`text-xs ${aggregates.responseRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {aggregates.responseRate >= 80 ? 'Good' : 'Needs improvement'}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm font-medium text-muted-foreground">Platform Ratings</span>
              <div className="space-y-2 mt-3">
                {Object.entries(aggregates.platformRatings).slice(0, 4).map(([platform, data]) => (
                  <div key={platform} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{platform}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= Math.round(data.avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="text-muted-foreground text-xs">({data.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <span className="text-sm font-medium text-muted-foreground">Sentiment</span>
              <div className="space-y-2 mt-3">
                {Object.entries(aggregates.sentimentDistribution).map(([label, count]) => {
                  const config = SENTIMENT_CONFIG[label];
                  const Icon = config?.icon || Minus;
                  return (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        <span className="capitalize">{label}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Platform Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activePlatform === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActivePlatform('all')}
        >
          All Platforms
        </Button>
        {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
          <Button
            key={key}
            variant={activePlatform === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePlatform(key)}
            className="gap-2"
          >
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${config.color}`}>
              {config.icon}
            </span>
            {config.label}
          </Button>
        ))}
      </div>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reviews {activePlatform !== 'all' ? `- ${PLATFORM_CONFIG[activePlatform]?.label}` : ''}</CardTitle>
          <CardDescription>{reviews.length} review(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <div className="divide-y">
              {reviews.map((review) => {
                const platformConf = PLATFORM_CONFIG[review.platform] || { icon: '?', color: 'bg-gray-100 text-gray-800', label: review.platform };
                const sentimentConf = SENTIMENT_CONFIG[review.sentimentLabel || 'neutral'] || SENTIMENT_CONFIG.neutral;
                const SentimentIcon = sentimentConf.icon;

                return (
                  <div key={review.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Platform Icon */}
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold shrink-0 ${platformConf.color}`}>
                          {platformConf.icon}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Author & Date */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm">{review.authorName}</span>
                            <RatingStars rating={review.rating} />
                            {review.respondedAt && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Responded
                              </Badge>
                            )}
                          </div>

                          {/* Title */}
                          {review.title && (
                            <p className="text-sm font-medium mb-1">{review.title}</p>
                          )}

                          {/* Content */}
                          {review.content && (
                            <p className="text-sm text-muted-foreground line-clamp-3">{review.content}</p>
                          )}

                          {/* Categories & Sentiment */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {review.sentimentLabel && (
                              <Badge className={`${sentimentConf.color} text-xs gap-1`} variant="secondary">
                                <SentimentIcon className="h-3 w-3" />
                                {review.sentimentLabel}
                              </Badge>
                            )}
                            {review.categories.map((cat) => (
                              <CategoryBadge key={cat} category={cat} />
                            ))}
                            {review.reviewDate && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(review.reviewDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Existing Response */}
                          {review.responseText && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Management Response ({new Date(review.respondedAt!).toLocaleDateString()})</p>
                              <p className="text-sm">{review.responseText}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRespond(review)}
                          className="gap-2"
                        >
                          <Reply className="h-4 w-4" />
                          {review.responseText ? 'Edit' : 'Respond'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {reviews.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No reviews found</p>
                  <p className="text-sm">Reviews will appear here once added or imported</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Respond Dialog */}
      <Dialog open={!!respondingTo} onOpenChange={(open) => { if (!open) { setRespondingTo(null); setSuggestedTone(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              {respondingTo && (
                <>Review by {respondingTo.authorName} on {PLATFORM_CONFIG[respondingTo.platform]?.label || respondingTo.platform}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {respondingTo && (
            <div className="space-y-4">
              {/* Original Review */}
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <RatingStars rating={respondingTo.rating} />
                  {respondingTo.sentimentLabel && (
                    <Badge className={`${SENTIMENT_CONFIG[respondingTo.sentimentLabel]?.color || ''} text-xs`} variant="secondary">
                      {respondingTo.sentimentLabel}
                    </Badge>
                  )}
                </div>
                {respondingTo.title && <p className="text-sm font-medium">{respondingTo.title}</p>}
                {respondingTo.content && <p className="text-sm text-muted-foreground">{respondingTo.content}</p>}
              </div>

              {/* AI Tone Suggestion */}
              {suggestedTone && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-1">AI Suggested Tone</p>
                  <p className="text-sm text-muted-foreground">{suggestedTone.suggestedTone}</p>
                  {suggestedTone.categories.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {suggestedTone.categories.map(c => <CategoryBadge key={c} category={c} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Response Text */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Response</label>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Write your response to this review..."
                  rows={5}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRespondingTo(null); setSuggestedTone(null); }}>Cancel</Button>
            <Button onClick={handleRespond} disabled={submittingResponse || !responseText.trim()}>
              {submittingResponse ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Submit Response</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Review Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Review</DialogTitle>
            <DialogDescription>Manually add a guest review</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={newReview.platform} onValueChange={(v) => setNewReview(p => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Author Name</label>
              <Input value={newReview.authorName} onChange={(e) => setNewReview(p => ({ ...p, authorName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setNewReview(p => ({ ...p, rating: star }))}>
                    <Star className={`h-6 w-6 ${star <= newReview.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={newReview.title} onChange={(e) => setNewReview(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea value={newReview.content} onChange={(e) => setNewReview(p => ({ ...p, content: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReview}>Add Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
