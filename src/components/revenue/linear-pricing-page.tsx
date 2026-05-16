'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';

interface RoomPricing {
  roomNumber: string;
  roomType: string;
  floor: number;
  currentPrice: number;
  suggestedPrice: number;
  occupancy: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  lastUpdated: string;
}

const mockRooms: RoomPricing[] = [
  { roomNumber: '101', roomType: 'Standard', floor: 1, currentPrice: 129, suggestedPrice: 119, occupancy: 42, status: 'available', lastUpdated: '10 min ago' },
  { roomNumber: '102', roomType: 'Standard', floor: 1, currentPrice: 129, suggestedPrice: 139, occupancy: 62, status: 'occupied', lastUpdated: '5 min ago' },
  { roomNumber: '103', roomType: 'Standard', floor: 1, currentPrice: 139, suggestedPrice: 149, occupancy: 68, status: 'available', lastUpdated: '15 min ago' },
  { roomNumber: '201', roomType: 'Deluxe', floor: 2, currentPrice: 189, suggestedPrice: 199, occupancy: 75, status: 'occupied', lastUpdated: '3 min ago' },
  { roomNumber: '202', roomType: 'Deluxe', floor: 2, currentPrice: 189, suggestedPrice: 179, occupancy: 55, status: 'available', lastUpdated: '8 min ago' },
  { roomNumber: '203', roomType: 'Deluxe', floor: 2, currentPrice: 199, suggestedPrice: 219, occupancy: 88, status: 'reserved', lastUpdated: '2 min ago' },
  { roomNumber: '301', roomType: 'Suite', floor: 3, currentPrice: 299, suggestedPrice: 329, occupancy: 92, status: 'available', lastUpdated: '1 min ago' },
  { roomNumber: '302', roomType: 'Suite', floor: 3, currentPrice: 289, suggestedPrice: 279, occupancy: 38, status: 'occupied', lastUpdated: '12 min ago' },
  { roomNumber: '303', roomType: 'Suite', floor: 3, currentPrice: 319, suggestedPrice: 349, occupancy: 97, status: 'reserved', lastUpdated: '1 min ago' },
  { roomNumber: '401', roomType: 'Presidential', floor: 4, currentPrice: 499, suggestedPrice: 549, occupancy: 100, status: 'occupied', lastUpdated: '30 sec ago' },
  { roomNumber: '104', roomType: 'Standard', floor: 1, currentPrice: 119, suggestedPrice: 109, occupancy: 28, status: 'available', lastUpdated: '20 min ago' },
  { roomNumber: '204', roomType: 'Deluxe', floor: 2, currentPrice: 189, suggestedPrice: 189, occupancy: 50, status: 'maintenance', lastUpdated: '1 hr ago' },
];

const statusColors: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  occupied: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  reserved: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function LinearPricingPage() {
  const [rooms, setRooms] = useState<RoomPricing[]>(mockRooms);
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [adjustmentPct, setAdjustmentPct] = useState('0');

  const filteredRooms = rooms.filter((r) => {
    if (floorFilter !== 'all' && r.floor !== parseInt(floorFilter)) return false;
    if (typeFilter !== 'all' && r.roomType.toLowerCase() !== typeFilter) return false;
    return true;
  });

  const allPrices = rooms.map((r) => r.currentPrice);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const avgPrice = Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length);

  const suggestedAllPrices = rooms.map((r) => r.suggestedPrice);
  const avgSuggested = Math.round(suggestedAllPrices.reduce((s, p) => s + p, 0) / suggestedAllPrices.length);

  const totalUplift = rooms.reduce((s, r) => s + (r.suggestedPrice - r.currentPrice), 0);

  const applySuggestedPrice = (roomNumber: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.roomNumber === roomNumber
          ? { ...r, currentPrice: r.suggestedPrice }
          : r
      )
    );
  };

  const applyAllSuggested = () => {
    setRooms((prev) =>
      prev.map((r) => ({ ...r, currentPrice: r.suggestedPrice }))
    );
  };

  const applyGlobalAdjustment = () => {
    const pct = parseFloat(adjustmentPct) / 100;
    if (isNaN(pct)) return;
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        currentPrice: Math.round(r.currentPrice * (1 + pct)),
        suggestedPrice: Math.round(r.suggestedPrice * (1 + pct)),
      }))
    );
  };

  const getPriceDiff = (room: RoomPricing) => {
    const diff = room.suggestedPrice - room.currentPrice;
    if (diff > 0) return { value: diff, direction: 'up' as const };
    if (diff < 0) return { value: Math.abs(diff), direction: 'down' as const };
    return { value: 0, direction: 'flat' as const };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Linear Room Pricing
          </h2>
          <p className="text-muted-foreground">
            Per-room unique pricing based on real-time occupancy and demand
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            onClick={applyAllSuggested}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
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
              <SelectItem value="1">Floor 1</SelectItem>
              <SelectItem value="2">Floor 2</SelectItem>
              <SelectItem value="3">Floor 3</SelectItem>
              <SelectItem value="4">Floor 4</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Room Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
              <SelectItem value="presidential">Presidential</SelectItem>
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
          <Button variant="outline" size="sm" onClick={applyGlobalAdjustment}>
            <ArrowUpDown className="h-4 w-4 mr-1" />
            Apply
          </Button>
        </div>
      </div>

      {/* Room Pricing Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
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
                  return (
                    <TableRow key={room.roomNumber} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-semibold">{room.roomNumber}</TableCell>
                      <TableCell>{room.roomType}</TableCell>
                      <TableCell>{room.floor}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[room.status]}>{room.status}</Badge>
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
                                room.occupancy > 90 ? 'bg-red-500' : room.occupancy > 60 ? 'bg-orange-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${room.occupancy}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{room.occupancy}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applySuggestedPrice(room.roomNumber)}
                          disabled={room.currentPrice === room.suggestedPrice}
                          className="h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
