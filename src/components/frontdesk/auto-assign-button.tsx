'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Loader2,
  Check,
  X,
  ArrowRight,
  Star,
  Waves,
  Mountain,
  DoorOpen,
  Accessibility,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RoomSuggestion {
  id: string;
  number: string;
  floor: number;
  score: number;
  reasons: string[];
  roomType: { id: string; name: string; code: string };
  features: {
    isAccessible: boolean;
    hasBalcony: boolean;
    hasSeaView: boolean;
    hasMountainView: boolean;
    isSmoking: boolean;
  };
  housekeepingStatus: string;
  lastCleanedAt: string | null;
}

interface AutoAssignButtonProps {
  bookingId: string;
  propertyId: string;
  onRoomAssigned?: (roomId: string, roomNumber: string) => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function AutoAssignButton({
  bookingId,
  propertyId,
  onRoomAssigned,
  variant = 'outline',
  size = 'sm',
  className,
}: AutoAssignButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RoomSuggestion[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/frontdesk/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, propertyId, auto: false }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to get suggestions');
      }

      const result = await response.json();
      if (result.success) {
        if (result.data.suggestions.length === 0) {
          toast({
            title: 'No Suggestions',
            description: 'No available rooms found for this booking',
            variant: 'destructive',
          });
          return;
        }
        setSuggestions(result.data.suggestions);
        setIsDialogOpen(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get room suggestions';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptSuggestion = async (suggestion: RoomSuggestion) => {
    setIsAccepting(true);
    try {
      // Assign the room via booking update
      const response = await fetch('/api/frontdesk/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, propertyId, auto: true }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to assign room');
      }

      toast({
        title: 'Room Assigned',
        description: `Room ${suggestion.number} (Floor ${suggestion.floor}) has been assigned automatically`,
      });

      setIsDialogOpen(false);
      setSuggestions([]);
      onRoomAssigned?.(suggestion.id, suggestion.number);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign room';
      toast({
        title: 'Assignment Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'seaView': return <Waves className="h-3 w-3" />;
      case 'mountainView': return <Mountain className="h-3 w-3" />;
      case 'balcony': return <DoorOpen className="h-3 w-3" />;
      case 'accessible': return <Accessibility className="h-3 w-3" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
    if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
    return 'bg-muted border-border';
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={fetchSuggestions}
        disabled={isLoading}
        className={cn(
          'gap-1.5',
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Auto-Assign</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); setSuggestions([]); } }}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Auto-Assign Suggestions
            </DialogTitle>
            <DialogDescription>
              Top 3 rooms ranked by suitability score based on guest preferences, room features, and cleaning status.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {suggestions.map((suggestion, idx) => (
                <Card
                  key={suggestion.id}
                  className={cn(
                    'p-4 border transition-all hover:shadow-md',
                    getScoreBg(suggestion.score)
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank */}
                    <div className="flex flex-col items-center justify-center min-w-[36px]">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                        idx === 0 ? 'bg-violet-500 text-white' :
                        idx === 1 ? 'bg-amber-400 text-white' :
                        'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                      )}>
                        {idx + 1}
                      </div>
                    </div>

                    {/* Room Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold">{suggestion.number}</span>
                        <Badge variant="outline" className="text-xs">
                          Floor {suggestion.floor}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.roomType.code}
                        </Badge>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <Star className={cn('h-3.5 w-3.5 fill-current', getScoreColor(suggestion.score))} />
                        <span className={cn('text-sm font-semibold', getScoreColor(suggestion.score))}>
                          {suggestion.score} points
                        </span>
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {suggestion.features.hasSeaView && (
                          <Badge variant="outline" className="text-xs gap-1 text-cyan-600 border-cyan-200 dark:text-cyan-400 dark:border-cyan-800">
                            <Waves className="h-3 w-3" /> Sea View
                          </Badge>
                        )}
                        {suggestion.features.hasMountainView && (
                          <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                            <Mountain className="h-3 w-3" /> Mountain View
                          </Badge>
                        )}
                        {suggestion.features.hasBalcony && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <DoorOpen className="h-3 w-3" /> Balcony
                          </Badge>
                        )}
                        {suggestion.features.isAccessible && (
                          <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
                            <Accessibility className="h-3 w-3" /> Accessible
                          </Badge>
                        )}
                        {suggestion.housekeepingStatus === 'inspected' && (
                          <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                            <Check className="h-3 w-3" /> Inspected
                          </Badge>
                        )}
                        {suggestion.lastCleanedAt && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="h-3 w-3" /> Cleaned recently
                          </Badge>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="space-y-0.5">
                        {suggestion.reasons.map((reason, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-2.5 w-2.5" />
                            {reason}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        onClick={() => acceptSuggestion(suggestion)}
                        disabled={isAccepting}
                        className={cn(
                          'gap-1',
                          idx === 0 && 'bg-violet-600 hover:bg-violet-700 text-white'
                        )}
                      >
                        {isAccepting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setSuggestions([]); }}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AutoAssignButton;
