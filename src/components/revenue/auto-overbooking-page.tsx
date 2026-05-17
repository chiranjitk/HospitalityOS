'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  BarChart3,
  Activity,
} from 'lucide-react';

interface OverbookingConfig {
  roomType: string;
  enabled: boolean;
  maxOverbookingPct: number;
  currentOverbooked: number;
  totalRooms: number;
}

const overbookingConfigs: OverbookingConfig[] = [
  { roomType: 'Standard', enabled: true, maxOverbookingPct: 10, currentOverbooked: 3, totalRooms: 40 },
  { roomType: 'Deluxe', enabled: true, maxOverbookingPct: 8, currentOverbooked: 2, totalRooms: 25 },
  { roomType: 'Suite', enabled: false, maxOverbookingPct: 5, currentOverbooked: 0, totalRooms: 10 },
  { roomType: 'Presidential', enabled: false, maxOverbookingPct: 0, currentOverbooked: 0, totalRooms: 3 },
];

const cancellationHistory = [
  { period: 'Last 7 days', rate: 12.3, total: 18, bookings: 146 },
  { period: 'Last 30 days', rate: 14.8, total: 62, bookings: 419 },
  { period: 'Last 90 days', rate: 13.2, total: 178, bookings: 1348 },
  { period: 'Last 12 months', rate: 15.1, total: 742, bookings: 4913 },
];

const recentActions = [
  { id: 1, time: '2 hrs ago', action: 'Overbooked Room 208 (Deluxe)', reason: 'Expected cancellation: 87%', status: 'active', risk: 'low' },
  { id: 2, time: '5 hrs ago', action: 'Overbooked Room 112 (Standard)', reason: 'Expected cancellation: 78%', status: 'active', risk: 'low' },
  { id: 3, time: '1 day ago', action: 'Auto-reassigned 210 → 215', reason: 'Guest from overbooked 210 needed walk', status: 'resolved', risk: 'medium' },
  { id: 4, time: '2 days ago', action: 'Overbooked Room 305 (Suite)', reason: 'Expected cancellation: 91%', status: 'cancelled', risk: 'low' },
  { id: 5, time: '3 days ago', action: 'Walk-in upgrade 101 → 201', reason: 'Double booking conflict resolved', status: 'resolved', risk: 'high' },
  { id: 6, time: '5 days ago', action: 'Overbooked Room 115 (Standard)', reason: 'Expected cancellation: 82%', status: 'active', risk: 'low' },
];

const riskColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const statusIcons: Record<string, typeof CheckCircle> = {
  active: Activity,
  resolved: CheckCircle,
  cancelled: XCircle,
};

export default function AutoOverbookingPage() {
  const [configs, setConfigs] = useState(overbookingConfigs);
  const [masterEnabled, setMasterEnabled] = useState(true);

  const toggleMaster = () => setMasterEnabled(!masterEnabled);

  const toggleRoomType = (roomType: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.roomType === roomType ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const updateMaxPct = (roomType: string, value: string) => {
    const pct = parseInt(value);
    if (isNaN(pct) || pct < 0 || pct > 50) return;
    setConfigs((prev) =>
      prev.map((c) => (c.roomType === roomType ? { ...c, maxOverbookingPct: pct } : c))
    );
  };

  const totalOverbooked = configs.reduce((s, c) => s + c.currentOverbooked, 0);
  const totalRooms = configs.reduce((s, c) => s + c.totalRooms, 0);
  const overallRisk = totalOverbooked / totalRooms * 100;

  const getRiskLevel = () => {
    if (overallRisk < 3) return { level: 'Low', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', pct: overallRisk };
    if (overallRisk < 6) return { level: 'Medium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', pct: overallRisk };
    if (overallRisk < 10) return { level: 'High', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', pct: overallRisk };
    return { level: 'Critical', color: 'text-red-700 dark:text-red-500', bg: 'bg-red-600', pct: overallRisk };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Auto-Overbooking
          </h2>
          <p className="text-muted-foreground">
            Smart overbooking engine driven by cancellation prediction models
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Master Switch</span>
          <Switch checked={masterEnabled} onCheckedChange={toggleMaster} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Total Overbooked</p>
                <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{totalOverbooked}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">of {totalRooms} total rooms</p>
              </div>
              <div className="p-3 rounded-full bg-teal-200 dark:bg-teal-800">
                <BarChart3 className="h-6 w-6 text-teal-700 dark:text-teal-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Cancellation Rate</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {cancellationHistory[0].rate}%
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Last 7 days</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <TrendingUp className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Prediction Accuracy</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">94.2%</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Last 30 days model score</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Activity className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Walks Avoided</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">47</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Last 90 days</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Shield className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Meter */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Current Overbooking Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Risk Level: <span className={risk.color}>{risk.level}</span></span>
                <span className="text-sm text-muted-foreground">{risk.pct.toFixed(1)}% overbooked</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${risk.bg}`}
                  style={{ width: `${Math.min(risk.pct * 5, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Safe</span>
                <span>Moderate</span>
                <span>Caution</span>
                <span>Danger</span>
              </div>
            </div>
            <div className="text-center px-6">
              <div className={`text-4xl font-bold ${risk.color}`}>{risk.pct.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Overbooking Ratio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room Type Config */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Room Type Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {configs.map((config) => (
              <div
                key={config.roomType}
                className={`p-4 rounded-lg border transition-colors ${
                  config.enabled
                    ? 'border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30'
                    : 'border-muted bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={config.enabled} onCheckedChange={() => toggleRoomType(config.roomType)} disabled={!masterEnabled} />
                    <span className="font-medium">{config.roomType}</span>
                    <Badge variant="outline">{config.totalRooms} rooms</Badge>
                  </div>
                  {config.currentOverbooked > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      {config.currentOverbooked} overbooked
                    </Badge>
                  )}
                </div>
                {config.enabled && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Max %:</Label>
                    <Input
                      type="number"
                      value={config.maxOverbookingPct}
                      onChange={(e) => updateMaxPct(config.roomType, e.target.value)}
                      className="w-20 h-8"
                      disabled={!masterEnabled}
                    />
                    <Progress value={config.currentOverbooked / config.totalRooms * 100 / (config.maxOverbookingPct / 100)} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground w-24 text-right">
                      {((config.currentOverbooked / config.totalRooms) * 100).toFixed(1)}% / {config.maxOverbookingPct}%
                    </span>
                  </div>
                )}
              </div>
            ))}
            <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" disabled={!masterEnabled}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Recent Actions Log */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              Recent Overbooking Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentActions.map((action) => {
                const StatusIcon = statusIcons[action.status];
                return (
                  <div
                    key={action.id}
                    className="p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${
                          action.status === 'active' ? 'text-blue-500' :
                          action.status === 'resolved' ? 'text-emerald-500' : 'text-red-400'
                        }`} />
                        <div>
                          <p className="font-medium text-sm">{action.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={riskColors[action.risk]}>{action.risk}</Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{action.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
