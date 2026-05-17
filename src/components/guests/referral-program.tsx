'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Gift, Users, TrendingUp, Award, Clock, CheckCircle2,
  Plus, Loader2, Copy, CircleDollarSign, Star, ArrowRight,
  RefreshCw, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Referral {
  id: string;
  referralCode: string;
  referralSource: string;
  rewardType: string;
  rewardAmount: number;
  status: string;
  convertedAt: string | null;
  rewardedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  referrer: { id: string; firstName: string; lastName: string; email: string | null };
}

interface ReferralStats {
  total: number;
  converted: number;
  rewarded: number;
  pending: number;
  expired: number;
  conversionRate: number;
  rewardRate: number;
  totalRewardValue: number;
  rewardsByType: Record<string, { count: number; total: number }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300', icon: Clock, label: 'Pending' },
  converted: { color: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300', icon: ArrowRight, label: 'Converted' },
  rewarded: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300', icon: Award, label: 'Rewarded' },
  expired: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: AlertCircle, label: 'Expired' },
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  points: 'Loyalty Points',
  credit: 'Account Credit',
  discount: 'Discount',
  free_night: 'Free Night',
};

export default function ReferralProgram() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [newReferral, setNewReferral] = useState({
    referrerId: '',
    referralSource: 'link',
    rewardType: 'points',
    rewardAmount: 500,
    expiresInDays: 90,
  });

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/guests/referrals?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) {
        setReferrals(json.data);
        setStats(json.stats);
      }
    } catch {
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const handleCreate = async () => {
    if (!newReferral.referrerId.trim()) {
      toast.error('Guest ID is required');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/guests/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReferral),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Referral code created');
        setCreateDialogOpen(false);
        setNewReferral({ referrerId: '', referralSource: 'link', rewardType: 'points', rewardAmount: 500, expiresInDays: 90 });
        fetchReferrals();
      } else {
        toast.error(json.error?.message || 'Failed to create referral');
      }
    } catch {
      toast.error('Failed to create referral');
    } finally {
      setCreating(false);
    }
  };

  const handleMarkConverted = async (referral: Referral) => {
    try {
      setUpdating(referral.id);
      const res = await fetch('/api/guests/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: referral.id, status: 'converted' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Referral marked as converted');
        fetchReferrals();
      } else {
        toast.error(json.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update referral');
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkRewarded = async (referral: Referral) => {
    try {
      setUpdating(referral.id);
      const res = await fetch('/api/guests/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: referral.id, status: 'rewarded', rewardAmount: referral.rewardAmount }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Referral reward issued');
        fetchReferrals();
      } else {
        toast.error(json.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update referral');
    } finally {
      setUpdating(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success(`Code ${code} copied to clipboard`);
    }).catch(() => {
      toast.error('Failed to copy code');
    });
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
          <h1 className="text-2xl font-bold tracking-tight">Referral Program</h1>
          <p className="text-muted-foreground">Track and manage guest referral codes and rewards</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReferrals} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create Referral Code
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Total Referrals</span>
              </div>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.pending} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Conversion Rate</span>
              </div>
              <div className="text-3xl font-bold">{stats.conversionRate}%</div>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="text-xs text-muted-foreground">{stats.converted} converted</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Reward Rate</span>
              </div>
              <div className="text-3xl font-bold">{stats.rewardRate}%</div>
              <p className="text-xs text-muted-foreground">{stats.rewarded} rewarded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Total Rewards Value</span>
              </div>
              <div className="text-3xl font-bold">{stats.totalRewardValue.toLocaleString()}</div>
              <div className="space-y-1 mt-2">
                {Object.entries(stats.rewardsByType).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{REWARD_TYPE_LABELS[type] || type}</span>
                    <span>{data.count}x ({data.total.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conversion Funnel */}
      {stats && stats.total > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /> Pending</span>
                  <span className="font-medium">{stats.pending}</span>
                </div>
                <Progress value={(stats.pending / stats.total) * 100} className="h-3" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-sky-500" /> Converted</span>
                  <span className="font-medium">{stats.converted}</span>
                </div>
                <Progress value={(stats.converted / stats.total) * 100} className="h-3" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2"><Award className="h-4 w-4 text-emerald-500" /> Rewarded</span>
                  <span className="font-medium">{stats.rewarded}</span>
                </div>
                <Progress value={(stats.rewarded / stats.total) * 100} className="h-3" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-gray-500" /> Expired</span>
                  <span className="font-medium">{stats.expired}</span>
                </div>
                <Progress value={(stats.expired / stats.total) * 100} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
          All ({stats?.total || 0})
        </Button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <Button key={key} variant={statusFilter === key ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(key)}>
            {config.label}
          </Button>
        ))}
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Referral Codes</CardTitle>
          <CardDescription>{referrals.length} referral(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <div className="divide-y">
              {referrals.map((referral) => {
                const statusConf = STATUS_CONFIG[referral.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConf.icon;

                return (
                  <div key={referral.id} className="p-4 hover:bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Guest Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">
                            {referral.referrer.firstName} {referral.referrer.lastName}
                          </span>
                          <Badge className={`${statusConf.color} text-xs gap-1`} variant="secondary">
                            <StatusIcon className="h-3 w-3" />
                            {statusConf.label}
                          </Badge>
                        </div>
                        {referral.referrer.email && (
                          <p className="text-xs text-muted-foreground mb-2">{referral.referrer.email}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm">
                          {/* Code */}
                          <button
                            onClick={() => handleCopyCode(referral.referralCode)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
                            title="Click to copy"
                          >
                            <Gift className="h-4 w-4 text-primary" />
                            <code className="text-xs font-mono font-bold">{referral.referralCode}</code>
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>

                          {/* Source */}
                          <span className="text-muted-foreground capitalize">{referral.referralSource}</span>

                          {/* Reward */}
                          <span className="text-muted-foreground">
                            {REWARD_TYPE_LABELS[referral.rewardType] || referral.rewardType}: {referral.rewardAmount.toLocaleString()}
                          </span>

                          {/* Dates */}
                          <span className="text-xs text-muted-foreground">
                            Created {new Date(referral.createdAt).toLocaleDateString()}
                          </span>
                          {referral.expiresAt && (
                            <span className="text-xs text-muted-foreground">
                              Expires {new Date(referral.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        {referral.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkConverted(referral)}
                            disabled={updating === referral.id}
                            className="gap-1"
                          >
                            {updating === referral.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Mark Converted
                          </Button>
                        )}
                        {referral.status === 'converted' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkRewarded(referral)}
                            disabled={updating === referral.id}
                            className="gap-1"
                          >
                            {updating === referral.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Award className="h-3 w-3" />}
                            Issue Reward
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {referrals.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No referrals found</p>
                  <p className="text-sm">Create referral codes for your guests to start tracking</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Referral Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Referral Code</DialogTitle>
            <DialogDescription>Generate a unique referral code for a guest</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Guest ID</label>
              <Input value={newReferral.referrerId} onChange={(e) => setNewReferral(p => ({ ...p, referrerId: e.target.value }))} placeholder="Enter guest ID" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Referral Source</label>
                <Select value={newReferral.referralSource} onValueChange={(v) => setNewReferral(p => ({ ...p, referralSource: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="qr">QR Code</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward Type</label>
                <Select value={newReferral.rewardType} onValueChange={(v) => setNewReferral(p => ({ ...p, rewardType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REWARD_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward Amount</label>
                <Input type="number" value={newReferral.rewardAmount} onChange={(e) => setNewReferral(p => ({ ...p, rewardAmount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expires In (Days)</label>
                <Input type="number" value={newReferral.expiresInDays} onChange={(e) => setNewReferral(p => ({ ...p, expiresInDays: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Referral Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
