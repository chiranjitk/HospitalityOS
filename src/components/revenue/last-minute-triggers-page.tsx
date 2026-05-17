'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Timer,
  Zap,
  TrendingDown,
  Clock,
  BarChart3,
  Settings,
  History,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface TriggerRule {
  id: string;
  windowHours: number;
  label: string;
  discountPct: number;
  minOccupancy: number;
  enabled: boolean;
  timesTriggered: number;
  revenueImpact: number;
}

const initialRules: TriggerRule[] = [
  { id: 't1', windowHours: 48, label: '48 Hours', discountPct: 5, minOccupancy: 40, enabled: true, timesTriggered: 23, revenueImpact: 4820 },
  { id: 't2', windowHours: 24, label: '24 Hours', discountPct: 10, minOccupancy: 50, enabled: true, timesTriggered: 18, revenueImpact: 6350 },
  { id: 't3', windowHours: 12, label: '12 Hours', discountPct: 15, minOccupancy: 60, enabled: true, timesTriggered: 12, revenueImpact: 3940 },
  { id: 't4', windowHours: 6, label: '6 Hours', discountPct: 20, minOccupancy: 70, enabled: false, timesTriggered: 7, revenueImpact: 2180 },
  { id: 't5', windowHours: 3, label: '3 Hours', discountPct: 25, minOccupancy: 80, enabled: false, timesTriggered: 3, revenueImpact: 980 },
];

const upcomingTriggers = [
  { id: 1, roomType: 'Deluxe', currentOcc: 52, threshold: 50, window: '24h', discount: 10, expectedAt: 'Tomorrow, 2:00 PM' },
  { id: 2, roomType: 'Suite', currentOcc: 64, threshold: 60, window: '12h', discount: 15, expectedAt: 'Today, 11:00 PM' },
  { id: 3, roomType: 'Standard', currentOcc: 44, threshold: 40, window: '48h', discount: 5, expectedAt: 'In 2 days' },
  { id: 4, roomType: 'Presidential', currentOcc: 35, threshold: 60, window: '12h', discount: 15, expectedAt: 'Not expected' },
];

const triggerHistory = [
  { id: 1, time: 'Today, 8:00 AM', roomType: 'Standard', window: '48h', discount: '5%', action: 'Price reduced $129 → $123', bookings: 3, status: 'success' },
  { id: 2, time: 'Today, 6:00 AM', roomType: 'Deluxe', window: '24h', discount: '10%', action: 'Price reduced $189 → $170', bookings: 2, status: 'success' },
  { id: 3, time: 'Yesterday, 9:00 PM', roomType: 'Suite', window: '12h', discount: '15%', action: 'Price reduced $299 → $254', bookings: 1, status: 'success' },
  { id: 4, time: 'Yesterday, 3:00 PM', roomType: 'Standard', window: '48h', discount: '5%', action: 'Trigger skipped (occupancy above min)', bookings: 0, status: 'skipped' },
  { id: 5, time: '2 days ago, 7:00 PM', roomType: 'Deluxe', window: '24h', discount: '10%', action: 'Price reduced $199 → $179', bookings: 4, status: 'success' },
  { id: 6, time: '3 days ago, 11:00 AM', roomType: 'Standard', window: '6h', discount: '20%', action: 'Price reduced $149 → $119', bookings: 2, status: 'success' },
  { id: 7, time: '4 days ago, 4:00 PM', roomType: 'Suite', window: '3h', discount: '25%', action: 'Rule disabled by manager', bookings: 0, status: 'cancelled' },
];

export default function LastMinuteTriggersPage() {
  const [rules, setRules] = useState<TriggerRule[]>(initialRules);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const updateDiscount = (id: string, value: string) => {
    const pct = parseInt(value);
    if (isNaN(pct) || pct < 0 || pct > 50) return;
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, discountPct: pct } : r))
    );
  };

  const updateMinOcc = (id: string, value: string) => {
    const val = parseInt(value);
    if (isNaN(val) || val < 0 || val > 100) return;
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, minOccupancy: val } : r))
    );
  };

  const activeRules = rules.filter((r) => r.enabled).length;
  const totalRevenueImpact = rules.reduce((s, r) => s + r.revenueImpact, 0);
  const totalBookings = 15;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Timer className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Last-Minute Pricing Triggers
          </h2>
          <p className="text-muted-foreground">
            Automatic discounts for unsold inventory as check-in approaches
          </p>
        </div>
        <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
          <Settings className="h-4 w-4 mr-2" />
          Advanced Settings
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Active Triggers</p>
                <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{activeRules}/{rules.length}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">Rules enabled</p>
              </div>
              <div className="p-3 rounded-full bg-teal-200 dark:bg-teal-800">
                <Zap className="h-6 w-6 text-teal-700 dark:text-teal-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Revenue Impact</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">${totalRevenueImpact.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">From trigger sales</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <BarChart3 className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Bookings Generated</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{totalBookings}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Last 30 days</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <TrendingDown className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Conversion</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">68%</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Trigger-to-booking rate</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <History className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trigger Rules */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Trigger Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Occ.</TableHead>
                  <TableHead>Fires</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={rule.enabled ? '' : 'opacity-50'}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {rule.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={rule.discountPct}
                          onChange={(e) => updateDiscount(rule.id, e.target.value)}
                          className="w-16 h-8 text-center"
                          disabled={!rule.enabled}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={rule.minOccupancy}
                          onChange={(e) => updateMinOcc(rule.id, e.target.value)}
                          className="w-16 h-8 text-center"
                          disabled={!rule.enabled}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.timesTriggered}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button className="w-full mt-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
              Save Rules
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Triggers */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              Upcoming Triggers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTriggers.map((trigger) => {
                const willTrigger = trigger.currentOcc >= trigger.threshold;
                return (
                  <div
                    key={trigger.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      willTrigger
                        ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30'
                        : 'border-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{trigger.roomType}</span>
                          <Badge className={willTrigger ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-muted text-muted-foreground'}>
                            {willTrigger ? 'Expected' : 'Unlikely'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {trigger.window} window · {trigger.discount}% discount · Current: {trigger.currentOcc}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{trigger.expectedAt}</p>
                        <p className="text-xs text-muted-foreground">Threshold: {trigger.threshold}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trigger History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Trigger History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggerHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{entry.time}</TableCell>
                    <TableCell className="font-medium">{entry.roomType}</TableCell>
                    <TableCell>{entry.window}</TableCell>
                    <TableCell>{entry.discount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{entry.action}</TableCell>
                    <TableCell className="text-right">{entry.bookings}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          entry.status === 'success'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                            : entry.status === 'skipped'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }
                      >
                        {entry.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
