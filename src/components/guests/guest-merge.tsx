'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Search,
  RefreshCw,
  GitMerge,
  ArrowRight,
  User,
  Mail,
  Phone,
  Globe,
  Crown,
  Star,
  FileText,
  CreditCard,
  MessageSquare,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface GuestProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  city: string | null;
  country: string | null;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
  kycStatus: string;
  status: string;
  createdAt: string;
  tags: string;
}

interface GuestMergePreview {
  primaryGuest: GuestProfile;
  mergeSummary: {
    bookingsMoved: number;
    foliosUpdated: number;
    paymentsMoved: number;
    documentsMoved: number;
    reviewsMoved: number;
    feedbackMoved: number;
    loyaltyPointsCombined: number;
    guestStaysMoved: number;
    loyaltyRedemptionsMoved: number;
    loyaltyTransactionsMoved: number;
    vehiclesMoved: number;
  };
  mergedDuplicateIds: string[];
}

interface DuplicateCandidate {
  guest: GuestProfile;
  matchReasons: string[];
  matchScore: number;
}

export default function GuestMerge() {
  const { toast } = useToast();

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GuestProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Comparison states
  const [selectedPrimary, setSelectedPrimary] = useState<GuestProfile | null>(null);
  const [selectedDuplicates, setSelectedDuplicates] = useState<GuestProfile[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);

  // Merge states
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<GuestMergePreview | null>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  // Search for potential duplicates
  const searchGuests = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/guests?search=${encodeURIComponent(query)}&limit=20`);
      if (!response.ok) throw new Error('Failed to search guests');
      const result = await response.json();
      if (result.success) {
        // Filter out already-merged guests
        const activeGuests = result.data.filter((g: GuestProfile) => g.status !== 'merged');
        setSearchResults(activeGuests);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to search guests', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchGuests(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchGuests]);

  // Find potential duplicates for a guest
  const findPotentialDuplicates = async (guest: GuestProfile) => {
    setSelectedPrimary(guest);
    setSelectedDuplicates([]);
    setMergeResult(null);
    setDuplicateCandidates([]);

    if (!guest.email && !guest.phone) {
      toast({
        title: 'Limited Search',
        description: 'Guest has no email or phone, duplicate detection is limited',
        variant: 'destructive',
      });
    }

    try {
      // Search by email and phone to find potential duplicates
      const queries: string[] = [];
      if (guest.email) queries.push(guest.email);
      if (guest.phone) queries.push(guest.phone);
      queries.push(`${guest.firstName} ${guest.lastName}`);
      queries.push(guest.lastName);

      const allResults: Map<string, DuplicateCandidate> = new Map();

      for (const q of queries) {
        const response = await fetch(`/api/guests?search=${encodeURIComponent(q)}&limit=50`);
        if (!response.ok) continue;
        const result = await response.json();
        if (!result.success) continue;

        for (const g of result.data) {
          if (g.id === guest.id || g.status === 'merged') continue;
          if (allResults.has(g.id)) continue;

          const reasons = computeMatchReasons(guest, g);
          if (reasons.length > 0) {
            allResults.set(g.id, {
              guest: g,
              matchReasons: reasons,
              matchScore: reasons.length,
            });
          }
        }
      }

      // Sort by match score descending
      const candidates = Array.from(allResults.values()).sort(
        (a, b) => b.matchScore - a.matchScore
      );

      setDuplicateCandidates(candidates);
    } catch {
      toast({ title: 'Error', description: 'Failed to find potential duplicates', variant: 'destructive' });
    }
  };

  // Compute match reasons between two guests
  const computeMatchReasons = (primary: GuestProfile, candidate: GuestProfile): string[] => {
    const reasons: string[] = [];

    if (primary.email && candidate.email && primary.email.toLowerCase() === candidate.email.toLowerCase()) {
      reasons.push('Same email address');
    }

    if (primary.phone && candidate.phone && primary.phone === candidate.phone) {
      reasons.push('Same phone number');
    }

    const primaryName = `${primary.firstName} ${primary.lastName}`.toLowerCase().trim();
    const candidateName = `${candidate.firstName} ${candidate.lastName}`.toLowerCase().trim();
    if (primaryName === candidateName) {
      reasons.push('Same full name');
    } else {
      // Partial name match
      if (primary.lastName.toLowerCase() === candidate.lastName.toLowerCase()) {
        reasons.push('Same last name');
      }
      if (primary.firstName.toLowerCase() === candidate.firstName.toLowerCase()) {
        reasons.push('Same first name');
      }
    }

    // Similar email pattern (e.g., first.last vs firstlast)
    if (primary.email && candidate.email && primary.email !== candidate.email) {
      const pLocal = primary.email.split('@')[0]?.toLowerCase().replace(/[._-]/g, '');
      const cLocal = candidate.email.split('@')[0]?.toLowerCase().replace(/[._-]/g, '');
      if (pLocal && cLocal && pLocal === cLocal) {
        reasons.push('Similar email pattern');
      }
    }

    // Same nationality and city
    if (primary.nationality && candidate.nationality && primary.nationality === candidate.nationality) {
      if (primary.city && candidate.city && primary.city === candidate.city) {
        reasons.push('Same nationality and city');
      }
    }

    return reasons;
  };

  // Toggle duplicate selection
  const toggleDuplicate = (guest: GuestProfile) => {
    setSelectedDuplicates(prev => {
      if (prev.find(g => g.id === guest.id)) {
        return prev.filter(g => g.id !== guest.id);
      }
      return [...prev, guest];
    });
  };

  // Execute merge
  const executeMerge = async () => {
    if (!selectedPrimary || selectedDuplicates.length === 0) return;

    setIsMerging(true);
    try {
      const response = await fetch('/api/guests/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryGuestId: selectedPrimary.id,
          duplicateGuestIds: selectedDuplicates.map(g => g.id),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Merge failed');
      }

      const result = await response.json();
      if (result.success) {
        setMergeResult(result.data);
        toast({
          title: 'Merge Complete',
          description: `Successfully merged ${selectedDuplicates.length} guest profile(s) into ${selectedPrimary.firstName} ${selectedPrimary.lastName}`,
        });
        setShowMergeConfirm(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Merge failed';
      toast({ title: 'Merge Failed', description: message, variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  // Reset
  const resetMerge = () => {
    setSelectedPrimary(null);
    setSelectedDuplicates([]);
    setDuplicateCandidates([]);
    setMergeResult(null);
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40',
      silver: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
      gold: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40',
      platinum: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40',
    };
    return colors[tier] || colors.bronze;
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 3) return 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20';
    if (score >= 2) return 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20';
    return 'border-border';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Guest Merge / Dedup
          </h2>
          <p className="text-sm text-muted-foreground">
            Find and merge duplicate guest profiles
          </p>
        </div>
        {selectedPrimary && (
          <Button variant="outline" onClick={resetMerge}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
        )}
      </div>

      {/* Step 1: Search for primary guest */}
      {!selectedPrimary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search for Primary Guest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSearching ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mb-2" />
                <p>No guests found</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">
                  {searchResults.map(guest => (
                    <div
                      key={guest.id}
                      onClick={() => findPotentialDuplicates(guest)}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                        {guest.firstName[0]}{guest.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{guest.firstName} {guest.lastName}</span>
                          {guest.isVip && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          <Badge className={cn('text-[10px]', getTierColor(guest.loyaltyTier))}>
                            {guest.loyaltyTier}
                          </Badge>
                          {guest.status === 'merged' && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Merged</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                          {guest.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{guest.email}</span>}
                          {guest.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guest.phone}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right shrink-0">
                        <div>{guest.totalStays} stays</div>
                        <div>{guest.loyaltyPoints} pts</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select duplicates and compare */}
      {selectedPrimary && !mergeResult && (
        <div className="space-y-4">
          {/* Primary Guest Card */}
          <Card className="border-primary/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Primary Profile
                </CardTitle>
                <Badge variant="default" className="text-xs">PRIMARY</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <GuestComparisonCard guest={selectedPrimary} />
            </CardContent>
          </Card>

          {/* Duplicate Candidates */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Potential Duplicates ({duplicateCandidates.length} found)
            </h3>
          </div>

          {duplicateCandidates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-500" />
                <p>No potential duplicates found</p>
                <p className="text-xs">This guest profile appears to be unique</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-2">
                {duplicateCandidates.map(candidate => {
                  const isSelected = selectedDuplicates.some(g => g.id === candidate.guest.id);
                  return (
                    <Card
                      key={candidate.guest.id}
                      className={cn(
                        'cursor-pointer transition-all',
                        isSelected ? 'border-primary bg-primary/5' : getMatchScoreColor(candidate.matchScore)
                      )}
                      onClick={() => toggleDuplicate(candidate.guest)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDuplicate(candidate.guest)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">{candidate.guest.firstName} {candidate.guest.lastName}</span>
                              <Badge className={cn('text-[10px]', getTierColor(candidate.guest.loyaltyTier))}>
                                {candidate.guest.loyaltyTier}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Star className="h-2.5 w-2.5" />
                                Score: {candidate.matchScore}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                              {candidate.guest.email && <span>{candidate.guest.email}</span>}
                              {candidate.guest.phone && <span>{candidate.guest.phone}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {candidate.matchReasons.map((reason, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                  <Copy className="h-2.5 w-2.5" />
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                            {/* Quick stats comparison */}
                            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                              <span>{candidate.guest.totalStays} stays</span>
                              <span>{candidate.guest.loyaltyPoints} pts</span>
                              <span>{candidate.guest.totalSpent > 0 ? `$${candidate.guest.totalSpent.toFixed(0)}` : '$0'} spent</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Merge Button */}
          {selectedDuplicates.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Merge {selectedDuplicates.length} profile(s) into {selectedPrimary.firstName} {selectedPrimary.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      All bookings, folios, payments, and loyalty points will be consolidated
                    </p>
                  </div>
                  <AlertDialog open={showMergeConfirm} onOpenChange={setShowMergeConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-primary hover:bg-primary/90 gap-2">
                        <GitMerge className="h-4 w-4" />
                        Merge Profiles
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          Confirm Guest Merge
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>
                            You are about to merge <strong>{selectedDuplicates.length}</strong> guest profile(s) into{' '}
                            <strong>{selectedPrimary.firstName} {selectedPrimary.lastName}</strong>.
                          </p>
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                            <p className="font-medium text-amber-700 dark:text-amber-300">This will:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-600 dark:text-amber-400">
                              <li>Move all bookings to the primary profile</li>
                              <li>Combine loyalty points</li>
                              <li>Transfer folios and payments</li>
                              <li>Move documents, reviews, and feedback</li>
                              <li>Mark duplicate profiles as merged</li>
                            </ul>
                          </div>
                          <p className="font-medium text-red-600 dark:text-red-400">
                            This action cannot be undone.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={executeMerge}
                          disabled={isMerging}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isMerging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
                          Confirm Merge
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Merge Result */}
      {mergeResult && (
        <div className="space-y-4">
          <Card className="border-emerald-300 dark:border-emerald-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                Merge Completed Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Merged primary profile */}
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-medium mb-2">Merged Profile</p>
                <GuestComparisonCard guest={mergeResult.primaryGuest as unknown as GuestProfile} />
              </div>

              {/* Merge summary */}
              <div>
                <p className="text-sm font-medium mb-2">Merge Summary</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(mergeResult.mergeSummary).map(([key, value]) => {
                    if (value === 0) return null;
                    const labels: Record<string, string> = {
                      bookingsMoved: 'Bookings Moved',
                      foliosUpdated: 'Folios Updated',
                      paymentsMoved: 'Payments Moved',
                      documentsMoved: 'Documents Moved',
                      reviewsMoved: 'Reviews Moved',
                      feedbackMoved: 'Feedback Moved',
                      loyaltyPointsCombined: 'Points Combined',
                      guestStaysMoved: 'Stays Moved',
                      loyaltyRedemptionsMoved: 'Redemptions Moved',
                      loyaltyTransactionsMoved: 'Point Transactions',
                      vehiclesMoved: 'Vehicles Moved',
                    };
                    return (
                      <div key={key} className="p-3 rounded-lg border bg-muted/30 text-center">
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{value}</div>
                        <div className="text-[10px] text-muted-foreground">{labels[key] || key}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetMerge}>
                  Merge Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Guest profile comparison card
function GuestComparisonCard({ guest }: { guest: GuestProfile }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
      <div>
        <span className="text-xs text-muted-foreground">Name</span>
        <p className="font-medium">{guest.firstName} {guest.lastName}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Email</span>
        <p className="font-medium truncate">{guest.email || '—'}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Phone</span>
        <p className="font-medium">{guest.phone || '—'}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Nationality</span>
        <p className="font-medium">{guest.nationality || '—'}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">City / Country</span>
        <p className="font-medium">{guest.city || '—'} {guest.country ? `(${guest.country})` : ''}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">KYC Status</span>
        <p className="font-medium">{guest.kycStatus}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Total Stays</span>
        <p className="font-medium tabular-nums">{guest.totalStays}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Loyalty Points</span>
        <p className="font-medium tabular-nums">{guest.loyaltyPoints}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Total Spent</span>
        <p className="font-medium tabular-nums">${guest.totalSpent.toFixed(2)}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Loyalty Tier</span>
        <p className="font-medium">{guest.loyaltyTier}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">VIP</span>
        <p className="font-medium">{guest.isVip ? 'Yes' : 'No'}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Created</span>
        <p className="font-medium">{format(new Date(guest.createdAt), 'MMM d, yyyy')}</p>
      </div>
    </div>
  );
}
