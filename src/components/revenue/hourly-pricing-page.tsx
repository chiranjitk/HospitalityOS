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
  Clock,
  TrendingUp,
  DollarSign,
  BarChart3,
  RefreshCw,
  Settings,
  Zap,
} from 'lucide-react';

const hourlyRates = [
  { hour: 0, rate: 89, occupancy: 35, label: '12 AM' },
  { hour: 1, rate: 79, occupancy: 30, label: '1 AM' },
  { hour: 2, rate: 69, occupancy: 22, label: '2 AM' },
  { hour: 3, rate: 59, occupancy: 18, label: '3 AM' },
  { hour: 4, rate: 59, occupancy: 15, label: '4 AM' },
  { hour: 5, rate: 69, occupancy: 20, label: '5 AM' },
  { hour: 6, rate: 89, occupancy: 32, label: '6 AM' },
  { hour: 7, rate: 109, occupancy: 45, label: '7 AM' },
  { hour: 8, rate: 129, occupancy: 55, label: '8 AM' },
  { hour: 9, rate: 149, occupancy: 62, label: '9 AM' },
  { hour: 10, rate: 159, occupancy: 68, label: '10 AM' },
  { hour: 11, rate: 169, occupancy: 72, label: '11 AM' },
  { hour: 12, rate: 179, occupancy: 78, label: '12 PM' },
  { hour: 13, rate: 189, occupancy: 82, label: '1 PM' },
  { hour: 14, rate: 199, occupancy: 88, label: '2 PM' },
  { hour: 15, rate: 209, occupancy: 91, label: '3 PM' },
  { hour: 16, rate: 219, occupancy: 95, label: '4 PM' },
  { hour: 17, rate: 229, occupancy: 97, label: '5 PM' },
  { hour: 18, rate: 249, occupancy: 100, label: '6 PM' },
  { hour: 19, rate: 239, occupancy: 98, label: '7 PM' },
  { hour: 20, rate: 219, occupancy: 92, label: '8 PM' },
  { hour: 21, rate: 199, occupancy: 85, label: '9 PM' },
  { hour: 22, rate: 169, occupancy: 75, label: '10 PM' },
  { hour: 23, rate: 129, occupancy: 55, label: '11 PM' },
];

const occupancyTiers = [
  { tier: 'Low', range: '0 – 30%', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950', price: 79 },
  { tier: 'Medium', range: '31 – 50%', color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950', price: 109 },
  { tier: 'High', range: '51 – 75%', color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950', price: 169 },
  { tier: 'Critical', range: '76 – 95%', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950', price: 229 },
  { tier: 'Sold Out', range: '96 – 100%', color: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950', price: 249 },
];

export default function HourlyPricingPage() {
  const [basePrice, setBasePrice] = useState('149');
  const [roomType, setRoomType] = useState('deluxe');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const maxRate = Math.max(...hourlyRates.map((h) => h.rate));
  const minRate = Math.min(...hourlyRates.map((h) => h.rate));

  const getBarColor = (occupancy: number) => {
    if (occupancy >= 96) return 'bg-gradient-to-t from-purple-500 to-purple-400';
    if (occupancy >= 76) return 'bg-gradient-to-t from-red-500 to-red-400';
    if (occupancy >= 51) return 'bg-gradient-to-t from-orange-500 to-orange-400';
    if (occupancy >= 31) return 'bg-gradient-to-t from-yellow-500 to-yellow-400';
    return 'bg-gradient-to-t from-emerald-500 to-emerald-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Hourly Dynamic Pricing
          </h2>
          <p className="text-muted-foreground">
            AI-driven hour-by-hour rate optimization based on demand patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={roomType} onValueChange={setRoomType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard Room</SelectItem>
              <SelectItem value="deluxe">Deluxe Room</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
              <SelectItem value="presidential">Presidential</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Base Price</p>
                <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">${basePrice}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">Starting reference rate</p>
              </div>
              <div className="p-3 rounded-full bg-teal-200 dark:bg-teal-800">
                <DollarSign className="h-6 w-6 text-teal-700 dark:text-teal-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Peak Rate</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">${maxRate}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  6 PM · {hourlyRates.find((h) => h.rate === maxRate)?.label}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <TrendingUp className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Lowest Rate</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">${minRate}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  4 AM · {hourlyRates.find((h) => h.rate === minRate)?.label}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <BarChart3 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Rate</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                  ${Math.round(hourlyRates.reduce((s, h) => s + h.rate, 0) / 24)}
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">24-hour average</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Zap className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Price Timeline */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            24-Hour Price Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48 mb-2">
            {hourlyRates.map((h) => (
              <div
                key={h.hour}
                className="flex-1 flex flex-col items-center gap-1 cursor-pointer group relative"
                onClick={() => setSelectedHour(selectedHour === h.hour ? null : h.hour)}
              >
                <div className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                  ${h.rate}
                </div>
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 min-h-[4px] ${
                    selectedHour === h.hour ? 'ring-2 ring-offset-1 ring-teal-500 opacity-100' : 'opacity-80 hover:opacity-100'
                  } ${getBarColor(h.occupancy)}`}
                  style={{ height: `${((h.rate - minRate + 10) / (maxRate - minRate + 20)) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
          {selectedHour !== null && (
            <div className="mt-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{hourlyRates[selectedHour].label} Details</p>
                  <p className="text-sm text-muted-foreground">
                    Rate: ${hourlyRates[selectedHour].rate} · Occupancy: {hourlyRates[selectedHour].occupancy}%
                  </p>
                </div>
                <Badge className={occupancyTiers.find((t) => hourlyRates[selectedHour].occupancy >= parseInt(t.range.split('–')[0]) && hourlyRates[selectedHour].occupancy <= parseInt(t.range.split('–')[1]))?.textColor || ''}>
                  {occupancyTiers.find((t) => hourlyRates[selectedHour].occupancy >= parseInt(t.range.split('–')[0]) && hourlyRates[selectedHour].occupancy <= parseInt(t.range.split('–')[1]))?.tier}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Occupancy Tiers + Controls */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Occupancy Tiers Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Occupancy-Based Pricing Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead className="text-right">Price/Night</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupancyTiers.map((tier) => (
                  <TableRow key={tier.tier} className={tier.bgColor}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${tier.color}`} />
                        <span className="font-medium">{tier.tier}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tier.range}</TableCell>
                    <TableCell className="text-right font-semibold">${tier.price}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{(tier.price / 149).toFixed(2)}x</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              Pricing Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Base Price ($)</Label>
              <Input
                id="basePrice"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="max-w-40"
              />
              <p className="text-xs text-muted-foreground">
                Reference rate used to calculate tier multipliers
              </p>
            </div>

            <div className="space-y-3">
              <Label>Occupancy Thresholds (%)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Low / Medium</Label>
                  <Input type="number" defaultValue={30} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Medium / High</Label>
                  <Input type="number" defaultValue={50} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">High / Critical</Label>
                  <Input type="number" defaultValue={75} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Critical / Sold Out</Label>
                  <Input type="number" defaultValue={96} className="h-9" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pricing Strategy</Label>
              <Select defaultValue="aggressive">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative (+5–15%)</SelectItem>
                  <SelectItem value="moderate">Moderate (+15–30%)</SelectItem>
                  <SelectItem value="aggressive">Aggressive (+30–60%)</SelectItem>
                  <SelectItem value="custom">Custom Multipliers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                <Zap className="h-4 w-4 mr-2" />
                Apply Changes
              </Button>
              <Button variant="outline">Reset to Default</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
