'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, Send, Plus, TrendingUp, TrendingDown, MessageSquare,
  ThumbsUp, Minus, ThumbsDown, Star, Loader2, AlertCircle, Users,
  Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface NpsSurvey {
  id: string;
  name: string;
  triggerEvent: string;
  subject: string | null;
  isActive: boolean;
  sentCount: number;
  responseCount: number;
  avgScore: number | null;
  createdAt: string;
  responseRate: number;
  stats: {
    total: number;
    avgScore: number;
    npsScore: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
}

interface NpsResponse {
  id: string;
  score: number;
  category: string;
  comment: string | null;
  respondedAt: string;
  guest: { id: string; firstName: string; lastName: string; email: string | null };
}

interface AggregateData {
  totalSurveys: number;
  totalResponses: number;
  avgScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  responseDistribution: { promoters: number; passives: number; detractors: number };
}

export default function NpsSurveys() {
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<NpsSurvey | null>(null);
  const [responses, setResponses] = useState<NpsResponse[]>([]);
  const [trendData, setTrendData] = useState<Record<string, { count: number; avg: number }>>({});
  const [scoreDistribution, setScoreDistribution] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ name: '', propertyId: '', triggerEvent: 'post_checkout', subject: '', message: '' });
  const [sendDays, setSendDays] = useState(7);

  const fetchSurveys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/guests/nps');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      if (json.success) {
        setSurveys(json.data);
        setAggregate(json.aggregate);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load NPS surveys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const handleSelectSurvey = async (survey: NpsSurvey) => {
    try {
      const res = await fetch(`/api/guests/nps/${survey.id}`);
      if (!res.ok) throw new Error('Failed to fetch details');
      const json = await res.json();
      if (json.success) {
        setSelectedSurvey(json.data);
        setResponses(json.data.responses || []);
        setTrendData(json.data.trendByDay || {});
        setScoreDistribution(json.data.stats?.scoreDistribution || {});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load survey details');
    }
  };

  const handleCreateSurvey = async () => {
    if (!newSurvey.name.trim()) {
      toast.error('Survey name is required');
      return;
    }
    try {
      const res = await fetch('/api/guests/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSurvey),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('NPS survey created');
        setCreateDialogOpen(false);
        setNewSurvey({ name: '', propertyId: '', triggerEvent: 'post_checkout', subject: '', message: '' });
        fetchSurveys();
      } else {
        toast.error(json.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create survey');
    }
  };

  const handleSendSurvey = async () => {
    if (!selectedSurvey) return;
    try {
      setSending(true);
      const res = await fetch(`/api/guests/nps/${selectedSurvey.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysSinceCheckout: sendDays }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Survey sent to ${json.data.sentCount} guests`);
        setSendDialogOpen(false);
        fetchSurveys();
      } else {
        toast.error(json.error?.message || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send survey');
    } finally {
      setSending(false);
    }
  };

  const getNpsColor = (score: number) => {
    if (score >= 50) return 'text-emerald-600';
    if (score >= 0) return 'text-amber-600';
    return 'text-red-600';
  };

  const getNpsBg = (score: number) => {
    if (score >= 50) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800';
    if (score >= 0) return 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800';
    return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'promoter': return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"><ThumbsUp className="h-3 w-3 mr-1" />Promoter</Badge>;
      case 'passive': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"><Minus className="h-3 w-3 mr-1" />Passive</Badge>;
      case 'detractor': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"><ThumbsDown className="h-3 w-3 mr-1" />Detractor</Badge>;
      default: return <Badge variant="secondary">{category}</Badge>;
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
          <h1 className="text-2xl font-bold tracking-tight">NPS Surveys</h1>
          <p className="text-muted-foreground">Track guest satisfaction with Net Promoter Score surveys</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Create Survey
        </Button>
      </div>

      {/* NPS Score Overview */}
      {aggregate && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={`border-2 ${getNpsBg(aggregate.npsScore)}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">NPS Score</span>
              </div>
              <div className={`text-4xl font-bold ${getNpsColor(aggregate.npsScore)}`}>
                {aggregate.npsScore > 0 ? '+' : ''}{aggregate.npsScore}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({aggregate.responseDistribution.promoters}% Promoters - {aggregate.responseDistribution.detractors}% Detractors)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Avg Score</span>
              </div>
              <div className="text-4xl font-bold">{aggregate.avgScore}</div>
              <p className="text-xs text-muted-foreground mt-1">out of 10</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Total Responses</span>
              </div>
              <div className="text-4xl font-bold">{aggregate.totalResponses}</div>
              <p className="text-xs text-muted-foreground mt-1">across {aggregate.totalSurveys} surveys</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Response Distribution</span>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs w-16">Promoters</span>
                  <Progress value={aggregate.responseDistribution.promoters} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-8 text-right">{aggregate.promoters}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Minus className="h-3 w-3 text-amber-600" />
                  <span className="text-xs w-16">Passive</span>
                  <Progress value={aggregate.responseDistribution.passives} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-8 text-right">{aggregate.passives}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-3 w-3 text-red-600" />
                  <span className="text-xs w-16">Detractors</span>
                  <Progress value={aggregate.responseDistribution.detractors} className="h-2 flex-1" />
                  <span className="text-xs font-medium w-8 text-right">{aggregate.detractors}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Survey List and Detail */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Survey List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Surveys</CardTitle>
              <CardDescription>{surveys.length} survey(s) configured</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <div className="divide-y">
                  {surveys.map((survey) => (
                    <button
                      key={survey.id}
                      onClick={() => handleSelectSurvey(survey)}
                      className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                        selectedSurvey?.id === survey.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{survey.name}</span>
                        <Badge variant={survey.isActive ? 'default' : 'secondary'} className="text-xs shrink-0 ml-2">
                          {survey.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" /> {survey.sentCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {survey.responseCount}
                        </span>
                        <span className={`font-semibold ${getNpsColor(survey.stats.npsScore)}`}>
                          NPS: {survey.stats.npsScore > 0 ? '+' : ''}{survey.stats.npsScore}
                        </span>
                      </div>
                    </button>
                  ))}
                  {surveys.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No surveys yet. Create your first NPS survey.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Survey Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSurvey ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-lg">{selectedSurvey.name}</CardTitle>
                    <CardDescription>
                      Trigger: {selectedSurvey.triggerEvent.replace(/_/g, ' ')} &middot; Created {new Date(selectedSurvey.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setSendDialogOpen(true)}
                    size="sm"
                    className="gap-2"
                    disabled={!selectedSurvey.isActive}
                  >
                    <Send className="h-4 w-4" /> Send Survey
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{selectedSurvey.stats.total}</div>
                      <div className="text-xs text-muted-foreground">Responses</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{selectedSurvey.stats.avgScore}</div>
                      <div className="text-xs text-muted-foreground">Avg Score</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className={`text-2xl font-bold ${getNpsColor(selectedSurvey.stats.npsScore)}`}>
                        {selectedSurvey.stats.npsScore > 0 ? '+' : ''}{selectedSurvey.stats.npsScore}
                      </div>
                      <div className="text-xs text-muted-foreground">NPS Score</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{selectedSurvey.responseRate}%</div>
                      <div className="text-xs text-muted-foreground">Response Rate</div>
                    </div>
                  </div>

                  {/* Score Distribution */}
                  {Object.keys(scoreDistribution).length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-3">Score Distribution</h4>
                      <div className="flex items-end gap-1 h-24">
                        {Object.entries(scoreDistribution).sort(([a], [b]) => Number(a) - Number(b)).map(([score, count]) => {
                          const maxCount = Math.max(...Object.values(scoreDistribution), 1);
                          const height = (count / maxCount) * 100;
                          const color = Number(score) >= 9 ? 'bg-emerald-500' : Number(score) >= 7 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div key={score} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">{count}</span>
                              <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${Math.max(height, 4)}%` }} />
                              <span className="text-xs text-muted-foreground">{score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Responses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Responses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-96">
                    <div className="divide-y">
                      {responses.map((response) => (
                        <div key={response.id} className="p-4 hover:bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm text-white ${
                                response.score >= 9 ? 'bg-emerald-500' :
                                response.score >= 7 ? 'bg-amber-500' : 'bg-red-500'
                              }`}>
                                {response.score}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {response.guest.firstName} {response.guest.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(response.respondedAt).toLocaleDateString()} &middot; {new Date(response.respondedAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            {getCategoryBadge(response.category)}
                          </div>
                          {response.comment && (
                            <p className="text-sm text-muted-foreground mt-2 ml-13 italic">
                              &ldquo;{response.comment}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                      {responses.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          No responses yet. Send the survey to start collecting feedback.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Select a survey</p>
                <p className="text-sm">Choose a survey from the list to view detailed analytics and responses</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Survey Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create NPS Survey</DialogTitle>
            <DialogDescription>Configure a new Net Promoter Score survey for your guests</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Survey Name</label>
              <Input value={newSurvey.name} onChange={(e) => setNewSurvey(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Post-Stay Guest Survey" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger Event</label>
              <Select value={newSurvey.triggerEvent} onValueChange={(v) => setNewSurvey(p => ({ ...p, triggerEvent: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="post_checkout">Post Checkout</SelectItem>
                  <SelectItem value="post_stay">Post Stay (1 day after)</SelectItem>
                  <SelectItem value="on_departure">On Departure</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Line</label>
              <Input value={newSurvey.subject} onChange={(e) => setNewSurvey(p => ({ ...p, subject: e.target.value }))} placeholder="How was your stay?" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea value={newSurvey.message} onChange={(e) => setNewSurvey(p => ({ ...p, message: e.target.value }))} placeholder="Please rate your experience..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSurvey}>Create Survey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Survey Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send NPS Survey</DialogTitle>
            <DialogDescription>Send the survey to guests who checked out in the last N days</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Days Since Checkout</label>
              <Input type="number" value={sendDays} onChange={(e) => setSendDays(Number(e.target.value))} min={1} max={90} />
              <p className="text-xs text-muted-foreground">Only guests who checked out within this period will receive the survey</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendSurvey} disabled={sending}>
              {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send Survey</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
