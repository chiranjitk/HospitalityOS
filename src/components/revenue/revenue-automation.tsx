'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Cpu,
  TrendingUp,
  DollarSign,
  Zap,
  Timer,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
} from 'lucide-react';

interface AutomationFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: 'active' | 'paused' | 'error';
  icon: typeof Cpu;
  color: string;
  impact: string;
}

const features: AutomationFeature[] = [
  { id: 'hourly', name: 'Hourly Dynamic Pricing', description: 'AI-driven hour-by-hour rate optimization', enabled: true, status: 'active', icon: Clock, color: 'text-teal-600 dark:text-teal-400', impact: '+$4,200/mo' },
  { id: 'linear', name: 'Linear Room Pricing', description: 'Per-room unique pricing based on occupancy', enabled: true, status: 'active', icon: BarChart3, color: 'text-cyan-600 dark:text-cyan-400', impact: '+$2,800/mo' },
  { id: 'overbooking', name: 'Auto-Overbooking', description: 'Smart overbooking with cancellation prediction', enabled: true, status: 'active', icon: Shield, color: 'text-amber-600 dark:text-amber-400', impact: '+$1,500/mo' },
  { id: 'lastminute', name: 'Last-Minute Triggers', description: 'Automatic discounts for unsold inventory', enabled: false, status: 'paused', icon: Timer, color: 'text-orange-600 dark:text-orange-400', impact: '+$980/mo' },
  { id: 'competitor', name: 'Competitor Price Matching', description: 'Auto-adjust rates based on competitor analysis', enabled: true, status: 'active', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', impact: '+$3,100/mo' },
  { id: 'demand', name: 'Demand Forecasting', description: 'ML-based demand prediction for rate planning', enabled: true, status: 'active', icon: Activity, color: 'text-violet-600 dark:text-violet-400', impact: '+$5,400/mo' },
];

const recentActions = [
  { id: 1, time: '10 min ago', feature: 'Hourly Pricing', action: 'Increased Suite rate to $329 (occupancy 92%)', impact: '+$30/night', status: 'applied' },
  { id: 2, time: '25 min ago', feature: 'Auto-Overbooking', action: 'Overbooked Room 208 (Deluxe)', impact: 'Expected: +$189', status: 'applied' },
  { id: 3, time: '1 hr ago', feature: 'Competitor Matching', action: 'Matched Booking.com rate for Standard rooms', impact: '-$10/night', status: 'applied' },
  { id: 4, time: '2 hrs ago', feature: 'Demand Forecast', action: 'Projected 95% occupancy for Saturday', impact: 'Recommended +$40', status: 'suggested' },
  { id: 5, time: '3 hrs ago', feature: 'Linear Pricing', action: 'Adjusted 6 rooms based on occupancy tiers', impact: '+$240/day', status: 'applied' },
  { id: 6, time: '4 hrs ago', feature: 'Hourly Pricing', action: 'Reduced 3 AM rate to $59 (low demand)', impact: '-$30/night', status: 'applied' },
  { id: 7, time: '5 hrs ago', feature: 'Last-Minute Trigger', action: 'Skipped: occupancy above threshold', impact: '$0', status: 'skipped' },
  { id: 8, time: '6 hrs ago', feature: 'Demand Forecast', action: 'Updated weekend forecast +8%', impact: 'Revised rates', status: 'applied' },
  { id: 9, time: '8 hrs ago', feature: 'Competitor Matching', action: 'Expedia price match applied', impact: '+$5/night', status: 'applied' },
  { id: 10, time: '12 hrs ago', feature: 'Auto-Overbooking', action: 'Walk avoided: reassigned 210 → 215', impact: 'Guest retained', status: 'resolved' },
];

export default function RevenueAutomation() {
  const [automationFeatures, setAutomationFeatures] = useState(features);
  const [masterToggle, setMasterToggle] = useState(true);

  const toggleFeature = (id: string) => {
    setAutomationFeatures((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, enabled: !f.enabled, status: f.enabled ? 'paused' : 'active' }
          : f
      )
    );
  };

  const toggleAll = (enabled: boolean) => {
    setMasterToggle(enabled);
    setAutomationFeatures((prev) =>
      prev.map((f) => ({ ...f, enabled, status: enabled ? 'active' : 'paused' }))
    );
  };

  const activeCount = automationFeatures.filter((f) => f.enabled).length;
  const totalImpact = automationFeatures
    .filter((f) => f.enabled)
    .reduce((s, f) => s + parseInt(f.impact.replace(/[^0-9]/g, '')), 0);
  const actionsToday = recentActions.length;
  const successRate = Math.round((recentActions.filter((a) => a.status === 'applied').length / actionsToday) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Revenue Automation Hub
          </h2>
          <p className="text-muted-foreground">
            Central control panel for all AI-powered revenue automation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {masterToggle ? 'All Systems Go' : 'All Paused'}
          </span>
          <Switch
            checked={masterToggle}
            onCheckedChange={toggleAll}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950 dark:to-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Active Features</p>
                <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{activeCount}/{automationFeatures.length}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">Automation modules running</p>
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
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Est. Revenue Uplift</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  +${totalImpact.toLocaleString()}/mo
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Combined automation impact</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Actions Today</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{actionsToday}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Automated adjustments</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Activity className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Success Rate</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{successRate}%</p>
                <Progress value={successRate} className="mt-2 h-2" />
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <TrendingUp className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Toggle Panel */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Automation Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {automationFeatures.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                    feature.enabled
                      ? 'border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30'
                      : 'border-muted bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm`}>
                        <FeatureIcon className={`h-5 w-5 ${feature.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{feature.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            feature.status === 'active'
                              ? 'text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700'
                              : feature.status === 'paused'
                              ? 'text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700'
                              : 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-700'
                          }`}
                        >
                          {feature.status}
                        </Badge>
                      </div>
                    </div>
                    <Switch checked={feature.enabled} onCheckedChange={() => toggleFeature(feature.id)} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{feature.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {feature.impact}
                    </span>
                    <span className="text-xs text-muted-foreground">Est. monthly</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Actions Timeline */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Recent Automation Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentActions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="mt-0.5">
                  {action.status === 'applied' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : action.status === 'suggested' ? (
                    <Zap className="h-4 w-4 text-amber-500" />
                  ) : action.status === 'resolved' ? (
                    <Shield className="h-4 w-4 text-blue-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs shrink-0">{action.feature}</Badge>
                    <span className="text-xs text-muted-foreground">{action.time}</span>
                  </div>
                  <p className="text-sm">{action.action}</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  {action.impact}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Impact Summary */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-teal-50 via-emerald-50 to-green-50 dark:from-teal-950 dark:via-emerald-950 dark:to-green-950">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="p-4 rounded-full bg-white dark:bg-gray-800 shadow-lg">
              <TrendingUp className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-lg font-bold">Estimated Revenue Uplift: +${totalImpact.toLocaleString()}/month</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {activeCount} active automation features processing {actionsToday} actions today with {successRate}% success rate.
                Continue optimizing for maximum revenue performance.
              </p>
            </div>
            <Button variant="outline" className="shrink-0">
              View Full Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
