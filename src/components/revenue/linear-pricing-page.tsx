'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BedDouble,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Minus,
  ArrowUpDown,
  RefreshCw,
  CheckCircle,
  BarChart3,
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// Types
// ============================================================

interface RoomPricing {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  roomTypeId: string;
  floor: number;
  currentPrice: number;
  suggestedPrice: number;
  occupancyRate: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  lastUpdated: string;
}

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  occupied: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  reserved: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function LinearPricingPage() {
  const { toast } = useToast();

  // Data state
  const [rooms, setRooms] = useState<RoomPricing[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  // UI state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [adjustmentPct, setAdjustmentPct] = useState('0');

  // Async state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingRoomId, setApplyingRoomId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingGlobal, setApplyingGlobal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/properties?limit=100');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const props = json.data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
        }));
        setProperties(props);
        // Auto-select first property if none selected
        if (props.length > 0 && !selectedPropertyId) {
          setSelectedPropertyId(props[0].id);
        }
      }
    } catch {
      // Silently fail — properties are supplementary
    }
  }, [selectedPropertyId]);

  const fetchRoomTypes = useCallback(async (propertyId: string) => {
    try {
      const res = await fetch(`/api/room-types?propertyId=${propertyId}&limit=100`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRoomTypes(
          json.data.map((rt: Record<string, unknown>) => ({
            id: rt.id as string,
            name: rt.name as string,
          }))
        );
      }
    } catch {
      // Silently fail — room types are supplementary
    }
  }, []);

  const fetchRoomPricing = useCallback(async (propertyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/revenue/hourly-pricing?propertyId=${propertyId}&detail=rooms`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRooms(json.data);
      } else {
        const errorMsg = json.error?.message || json.error?.code || 'Failed to fetch pricing data';
        setError(errorMsg);
        setRooms([]);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error fetching pricing data';
      setError(errorMsg);
      setRooms([]);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initial load: fetch properties first
  useEffect(() => {
    fetchProperties();
  }, []);

  // When property is selected, fetch room types and pricing
  useEffect(() => {
    if (selectedPropertyId) {
      fetchRoomTypes(selectedPropertyId);
      fetchRoomPricing(selectedPropertyId);
    }
  }, [selectedPropertyId, fetchRoomTypes, fetchRoomPricing]);

  // ============================================================
  // Actions
  // ============================================================

  const handleRefresh = async () => {
    if (!selectedPropertyId) return;
    setRefreshing(true);
    await fetchRoomPricing(selectedPropertyId);
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Room pricing data has been refreshed.',
    });
  };

  const applySuggestedPrice = async (room: RoomPricing) => {
    setApplyingRoomId(room.roomId);
    try {
      const res = await fetch('/api/revenue/hourly-pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.roomId,
          price: room.suggestedPrice,
          suggestedPrice: room.suggestedPrice,
          propertyId: selectedPropertyId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Update local state optimistically
        setRooms((prev) =>
          prev.map((r) =>
            r.roomId === room.roomId
              ? { ...r, currentPrice: room.suggestedPrice, lastUpdated: new Date().toISOString() }
              : r
          )
        );
        toast({
          title: 'Price Applied',
          description: `Room ${room.roomNumber}: $${room.currentPrice} → $${room.suggestedPrice}`,
        });
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to apply suggested price',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply suggested price',
        variant: 'destructive',
      });
    } finally {
      setApplyingRoomId(null);
    }
  };

  const applyAllSuggested = async () => {
    if (!selectedPropertyId) return;
    setApplyingAll(true);
    try {
      const res = await fetch('/api/revenue/hourly-pricing/apply-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedPropertyId }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: 'All Suggested Prices Applied',
          description: `${json.data.totalRatesChanged} room type(s) updated successfully.`,
        });
        // Re-fetch to get updated data
        await fetchRoomPricing(selectedPropertyId);
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to apply all suggested prices',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply all suggested prices',
        variant: 'destructive',
      });
    } finally {
      setApplyingAll(false);
    }
  };

  const applyGlobalAdjustment = async () => {
    const pct = parseFloat(adjustmentPct) / 100;
    if (isNaN(pct) || pct === 0) {
      toast({
        title: 'Invalid Adjustment',
        description: 'Please enter a non-zero percentage value.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPropertyId) return;
    setApplyingGlobal(true);

    try {
      // Apply global adjustment to each room type
      const roomTypeIds = [...new Set(rooms.map((r) => r.roomTypeId))];
      let updatedCount = 0;

      for (const rtId of roomTypeIds) {
        const roomsOfType = rooms.filter((r) => r.roomTypeId === rtId);
        if (roomsOfType.length === 0) continue;

        const currentPrice = roomsOfType[0].currentPrice;
        const newPrice = Math.round(currentPrice * (1 + pct) * 100) / 100;

        // Use the first room of each type to update the room type's base price
        const firstRoom = roomsOfType[0];
        const res = await fetch('/api/revenue/hourly-pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: firstRoom.roomId,
            price: newPrice,
            propertyId: selectedPropertyId,
          }),
        });
        const json = await res.json();
        if (json.success) updatedCount++;
      }

      if (updatedCount > 0) {
        // Update local state
        setRooms((prev) =>
          prev.map((r) => ({
            ...r,
            currentPrice: Math.round(r.currentPrice * (1 + pct) * 100) / 100,
            suggestedPrice: Math.round(r.suggestedPrice * (1 + pct) * 100) / 100,
            lastUpdated: new Date().toISOString(),
          }))
        );
        toast({
          title: 'Global Adjustment Applied',
          description: `${adjustedLabel(pct)} applied to ${updatedCount} room type(s).`,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply global adjustment',
        variant: 'destructive',
      });
    } finally {
      setApplyingGlobal(false);
    }
  };

  const adjustedLabel = (pct: number) =>
    pct > 0 ? `+${Math.round(pct * 100)}%` : `${Math.round(pct * 100)}%`;

  // ============================================================
  // Computed Values
  // ============================================================

  const filteredRooms = rooms.filter((r) => {
    if (floorFilter !== 'all' && r.floor !== parseInt(floorFilter)) return false;
    if (typeFilter !== 'all' && r.roomTypeName.toLowerCase() !== typeFilter.toLowerCase()) return false;
    return true;
  });

  const allPrices = rooms.map((r) => r.currentPrice);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const avgPrice = allPrices.length > 0 ? Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length) : 0;

  const suggestedAllPrices = rooms.map((r) => r.suggestedPrice);
  const avgSuggested = suggestedAllPrices.length > 0 ? Math.round(suggestedAllPrices.reduce((s, p) => s + p, 0) / suggestedAllPrices.length) : 0;

  const totalUplift = rooms.reduce((s, r) => s + (r.suggestedPrice - r.currentPrice), 0);

  // Unique floors from room data
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);

  const getPriceDiff = (room: RoomPricing) => {
    const diff = room.suggestedPrice - room.currentPrice;
    if (diff > 0) return { value: diff, direction: 'up' as const };
    if (diff < 0) return { value: Math.abs(diff), direction: 'down' as const };
    return { value: 0, direction: 'flat' as const };
  };

  // ============================================================
  // Render: Property Selector
  // ============================================================

  const renderPropertySelector = () => (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedPropertyId} onValueChange={(val) => {
        setSelectedPropertyId(val);
        setFloorFilter('all');
        setTypeFilter('all');
      }}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Select property" />
        </SelectTrigger>
        <SelectContent>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (loading && rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
        <p className="text-muted-foreground text-sm">Loading room pricing data…</p>
      </div>
    );
  }

  // ============================================================
  // Render: Error State (no property or API error with no data)
  // ============================================================

  if (!selectedPropertyId && properties.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="text-muted-foreground text-sm">No properties found. Please create a property first.</p>
      </div>
    );
  }

  if (error && rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // ============================================================
  // Render: Main Content
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Linear Room Pricing
          </h2>
          <p className="text-muted-foreground">
            Per-room unique pricing based on real-time occupancy and demand
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {renderPropertySelector()}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            onClick={applyAllSuggested}
            disabled={applyingAll || rooms.length === 0}
          >
            {applyingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Apply All Suggested
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Min Price</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">${minPrice}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Lowest room rate</p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <TrendingDown className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Max Price</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">${maxPrice}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Highest room rate</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <TrendingUp className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Average Price</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">${avgPrice}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Across all rooms</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <BarChart3 className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Est. Uplift</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {totalUplift >= 0 ? '+' : ''}${totalUplift}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Avg suggested: ${avgSuggested}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <DollarSign className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Global Adjustment */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  Floor {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Room Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {roomTypes.map((rt) => (
                <SelectItem key={rt.id} value={rt.name.toLowerCase()}>
                  {rt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Global Adjust:</Label>
          <Input
            type="number"
            value={adjustmentPct}
            onChange={(e) => setAdjustmentPct(e.target.value)}
            className="w-20 h-9"
            placeholder="0"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={applyGlobalAdjustment}
            disabled={applyingGlobal || rooms.length === 0}
          >
            {applyingGlobal ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ArrowUpDown className="h-4 w-4 mr-1" />
            )}
            Apply
          </Button>
        </div>
      </div>

      {/* Room Pricing Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2">
              <BedDouble className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No room pricing data available</p>
              {rooms.length > 0 && filteredRooms.length === 0 && (
                <p className="text-muted-foreground text-xs">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Suggested</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead className="text-right">Occupancy</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => {
                    const diff = getPriceDiff(room);
                    const isApplying = applyingRoomId === room.roomId;
                    return (
                      <TableRow key={room.roomId} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-semibold">{room.roomNumber}</TableCell>
                        <TableCell>{room.roomTypeName}</TableCell>
                        <TableCell>{room.floor}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[room.status] || ''}>{room.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">${room.currentPrice}</TableCell>
                        <TableCell className="text-right font-medium">${room.suggestedPrice}</TableCell>
                        <TableCell className="text-right">
                          {diff.direction === 'up' && (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3" />+${diff.value}
                            </span>
                          )}
                          {diff.direction === 'down' && (
                            <span className="text-red-500 dark:text-red-400 flex items-center justify-end gap-1">
                              <TrendingDown className="h-3 w-3" />-${diff.value}
                            </span>
                          )}
                          {diff.direction === 'flat' && (
                            <span className="text-muted-foreground flex items-center justify-end gap-1">
                              <Minus className="h-3 w-3" />$0
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  room.occupancyRate > 90 ? 'bg-red-500' : room.occupancyRate > 60 ? 'bg-orange-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${room.occupancyRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{room.occupancyRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applySuggestedPrice(room)}
                            disabled={room.currentPrice === room.suggestedPrice || isApplying}
                            className="h-7 text-xs"
                          >
                            {isApplying ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Apply'
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
