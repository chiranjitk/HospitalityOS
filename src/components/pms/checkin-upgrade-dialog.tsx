'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Crown,
  Sparkles,
  UtensilsCrossed,
  Dumbbell,
  Wine,
  Star,
  ArrowRight,
  Check,
  BedDouble,
  Waves,
  MapPin,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UpgradeOffer {
  type: 'room_upgrade';
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  description: string | null;
  sizeSqMeters: number | null;
  currentPricePerNight: number;
  upgradePricePerNight: number;
  priceDifference: number;
  priceDifferencePerNight: number;
  nights: number;
  availableRooms: number;
  amenitiesGained: string[];
  allAmenities: string[];
  images: string[];
  valueScore: number;
  currency: string;
}

interface CrossSellOffer {
  type: string;
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image?: string;
}

interface UpgradeOffersData {
  bookingId: string;
  confirmationCode: string;
  currentRoomType: { id: string; name: string; basePrice: number };
  guest: { id: string; firstName: string; lastName: string; loyaltyTier: string };
  nights: number;
  loyaltyTier: string;
  loyaltyDiscount: number;
  upgradeOffers: UpgradeOffer[];
  crossSellOffers: CrossSellOffer[];
}

interface CheckinUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  onUpgradeAccepted?: (data: { roomTypeId: string; totalCharge: number }) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  spa: <Waves className="h-4 w-4" />,
  dining: <UtensilsCrossed className="h-4 w-4" />,
  experiences: <MapPin className="h-4 w-4" />,
  activity: <Dumbbell className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  spa: 'Spa & Wellness',
  dining: 'Dining',
  experiences: 'Experiences',
  activity: 'Activities',
};

const LOYALTY_COLORS: Record<string, string> = {
  bronze: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  silver: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800',
  gold: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  platinum: 'text-slate-400 bg-slate-100 dark:text-slate-300 dark:bg-slate-800',
  diamond: 'text-cyan-500 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-900/30',
};

export default function CheckinUpgradeDialog({
  open,
  onOpenChange,
  bookingId,
  onUpgradeAccepted,
}: CheckinUpgradeDialogProps) {
  const { toast } = useToast();
  const [data, setData] = useState<UpgradeOffersData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUpgrades, setSelectedUpgrades] = useState<Set<string>>(new Set());
  const [selectedCrossSells, setSelectedCrossSells] = useState<Set<string>>(new Set());
  const [isAccepting, setIsAccepting] = useState(false);
  const [activeTab, setActiveTab] = useState<'upgrades' | 'addons'>('upgrades');

  const fetchOffers = useCallback(async () => {
    if (!bookingId || !open) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/upgrade-offers?bookingId=${bookingId}`);
      if (!response.ok) throw new Error('Failed to fetch upgrade offers');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to load upgrade options',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load upgrade options',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, open, toast]);

  useEffect(() => {
    if (open && bookingId) {
      fetchOffers();
      setSelectedUpgrades(new Set());
      setSelectedCrossSells(new Set());
    }
  }, [open, bookingId, fetchOffers]);

  const toggleUpgrade = (roomTypeId: string) => {
    setSelectedUpgrades(prev => {
      const next = new Set(prev);
      if (next.has(roomTypeId)) {
        next.delete(roomTypeId);
      } else {
        next.clear(); // Only one room upgrade at a time
        next.add(roomTypeId);
      }
      return next;
    });
  };

  const toggleCrossSell = (id: string) => {
    setSelectedCrossSells(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalUpgradeCost = (() => {
    if (!data) return 0;
    let total = 0;
    for (const roomTypeId of selectedUpgrades) {
      const offer = data.upgradeOffers.find(o => o.roomTypeId === roomTypeId);
      if (offer) total += offer.priceDifference;
    }
    for (const id of selectedCrossSells) {
      const offer = data.crossSellOffers.find(o => o.id === id);
      if (offer) total += offer.price;
    }
    return total;
  })();

  const handleAccept = async () => {
    if (selectedUpgrades.size === 0 && selectedCrossSells.size === 0) {
      onOpenChange(false);
      return;
    }

    setIsAccepting(true);
    try {
      // Post the upgrade to the folio
      const selectedUpgradeId = [...selectedUpgrades][0];
      const offer = data?.upgradeOffers.find(o => o.roomTypeId === selectedUpgradeId);

      if (offer && onUpgradeAccepted) {
        onUpgradeAccepted({
          roomTypeId: offer.roomTypeId,
          totalCharge: totalUpgradeCost,
        });
      }

      toast({
        title: 'Upgrade Applied',
        description: `${offer ? `Upgraded to ${offer.roomTypeName}` : 'Add-ons added'}. ${totalUpgradeCost > 0 ? `$${totalUpgradeCost.toFixed(2)} charged to folio.` : ''}`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply upgrade',
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const hasSelections = selectedUpgrades.size > 0 || selectedCrossSells.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-amber-500" />
            Upgrade Your Stay
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.confirmationCode} — ${data.currentRoomType.name} (${data.nights} night${data.nights > 1 ? 's' : ''})`
              : 'Loading upgrade options...'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-muted-foreground">
            <BedDouble className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>No upgrade options available</p>
          </div>
        ) : (
          <>
            {/* Guest Loyalty Badge */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {data.guest.firstName} {data.guest.lastName}
                </span>
                <Badge className={cn('text-xs', LOYALTY_COLORS[data.loyaltyTier] || '')}>
                  {data.loyaltyTier.charAt(0).toUpperCase() + data.loyaltyTier.slice(1)}
                </Badge>
              </div>
              {data.loyaltyDiscount > 0 && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm">
                  <Star className="h-3.5 w-3.5" />
                  <span>{(data.loyaltyDiscount * 100).toFixed(0)}% loyalty discount on add-ons</span>
                </div>
              )}
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={activeTab === 'upgrades' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-9"
                onClick={() => setActiveTab('upgrades')}
              >
                <BedDouble className="h-4 w-4 mr-1" />
                Room Upgrades
                {data.upgradeOffers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{data.upgradeOffers.length}</Badge>
                )}
              </Button>
              <Button
                variant={activeTab === 'addons' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-9"
                onClick={() => setActiveTab('addons')}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Add-Ons
                {data.crossSellOffers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{data.crossSellOffers.length}</Badge>
                )}
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {activeTab === 'upgrades' ? (
                <>
                  {data.upgradeOffers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">No room upgrades available</p>
                      <p className="text-sm mt-1">All higher room types are currently sold out</p>
                    </div>
                  ) : (
                    data.upgradeOffers.map((offer) => {
                      const isSelected = selectedUpgrades.has(offer.roomTypeId);
                      return (
                        <Card
                          key={offer.roomTypeId}
                          className={cn(
                            'cursor-pointer transition-all duration-200 relative overflow-hidden',
                            isSelected
                              ? 'border-2 border-primary shadow-md ring-1 ring-primary/20'
                              : 'border hover:border-primary/50 hover:shadow-sm'
                          )}
                          onClick={() => toggleUpgrade(offer.roomTypeId)}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                              {/* Room info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-base">{offer.roomTypeName}</h3>
                                  {offer.valueScore < offer.priceDifference * 0.5 && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Star className="h-3 w-3 mr-0.5" />
                                      Best Value
                                    </Badge>
                                  )}
                                </div>
                                {offer.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {offer.description}
                                  </p>
                                )}
                                {offer.sizeSqMeters && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {offer.sizeSqMeters} m² · {offer.availableRooms} room{offer.availableRooms > 1 ? 's' : ''} available
                                  </p>
                                )}
                                {/* Amenities gained */}
                                {offer.amenitiesGained.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {offer.amenitiesGained.slice(0, 4).map((amenity, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                        {amenity}
                                      </Badge>
                                    ))}
                                    {offer.amenitiesGained.length > 4 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{offer.amenitiesGained.length - 4} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Price */}
                              <div className="flex flex-col items-end justify-center min-w-[120px]">
                                <div className="text-sm text-muted-foreground line-through">
                                  ${offer.currentPricePerNight.toFixed(0)}/nt
                                </div>
                                <div className="text-lg font-bold">
                                  ${offer.upgradePricePerNight.toFixed(0)}
                                  <span className="text-sm font-normal text-muted-foreground">/nt</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm font-medium text-primary mt-1">
                                  <ArrowRight className="h-3 w-3" />
                                  +${offer.priceDifferencePerNight.toFixed(0)}/nt
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  +${offer.priceDifference.toFixed(2)} total
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  {/* Cross-sell offers */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.crossSellOffers.map((offer) => {
                      const isSelected = selectedCrossSells.has(offer.id);
                      const icon = CATEGORY_ICONS[offer.category] || <Sparkles className="h-4 w-4" />;
                      const label = CATEGORY_LABELS[offer.category] || offer.category;

                      return (
                        <Card
                          key={offer.id}
                          className={cn(
                            'cursor-pointer transition-all duration-200 relative',
                            isSelected
                              ? 'border-2 border-primary shadow-md'
                              : 'border hover:border-primary/50 hover:shadow-sm'
                          )}
                          onClick={() => toggleCrossSell(offer.id)}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5 z-10">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-muted shrink-0">
                                {icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <Badge variant="outline" className="text-xs mb-1">{label}</Badge>
                                <h4 className="font-medium text-sm">{offer.name}</h4>
                                {offer.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {offer.description}
                                  </p>
                                )}
                                <div className="text-sm font-bold mt-2">
                                  ${offer.price.toFixed(2)}
                                  {data.loyaltyDiscount > 0 && (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">
                                      (loyalty price)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {hasSelections && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total additional charge</p>
                    <p className="text-xl font-bold">
                      ${totalUpgradeCost.toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {data.currency}
                      </span>
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setSelectedUpgrades(new Set()); setSelectedCrossSells(new Set()); }}>
                      Clear
                    </Button>
                    <Button onClick={handleAccept} disabled={isAccepting}>
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wine className="h-4 w-4 mr-2" />
                      )}
                      Accept & Charge to Folio
                    </Button>
                  </DialogFooter>
                </div>
              </>
            )}

            {/* No selection footer */}
            {!hasSelections && (
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  No Thanks, Continue Check-In
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
